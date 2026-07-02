import { Router, type IRouter } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { getAuth } from "@clerk/express";
import { eq, and, desc, ilike, sql } from "drizzle-orm";
import { db, gamesTable, likesTable, reviewsTable, reviewHelpfulTable } from "@workspace/db";
import {
  GenerateGameBody,
  SaveGameBody,
  GetGameParams,
  UpdateGameParams,
  UpdateGameBody,
  DeleteGameParams,
  PublishGameParams,
  ToggleLikeParams,
  GetGameBySlugParams,
  ListPublicGamesQueryParams,
  ChatEditGameParams,
  ChatEditGameBody,
  PlanGameBody,
  RefinePlanBody,
} from "@workspace/api-zod";
import { generate3DGame } from "../lib/generate3d";
import { generate2DGame } from "../lib/generate2d";
import { generateSpritesForGame } from "../lib/generateGameSprites";
import { generateAndSaveCover } from "../lib/imageGeneration";

const router: IRouter = Router();

const MAX_PROMPT_LENGTH = 4000;

// ── Play-count server-side dedup (IP + gameId, 5-minute TTL) ─────────────────
const playedRecently = new Map<string, number>();
const PLAY_TTL_MS = 5 * 60 * 1000;

function throttlePlay(ip: string, gameId: number): boolean {
  const key = `${ip}:${gameId}`;
  const last = playedRecently.get(key);
  const now = Date.now();
  if (last && now - last < PLAY_TTL_MS) return false;
  playedRecently.set(key, now);
  if (playedRecently.size > 5000) {
    for (const [k, t] of playedRecently) {
      if (now - t > PLAY_TTL_MS) playedRecently.delete(k);
    }
  }
  return true;
}

// ── SSE helpers ───────────────────────────────────────────────────────────────
// Switch a response to Server-Sent Events and keep the connection alive with
// a heartbeat ping every 10 seconds. Returns a cleanup function.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function startSSE(res: any): () => void {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable nginx/CDN buffering
  res.flushHeaders();
  const timer = setInterval(() => {
    try { res.write('data: {"type":"thinking"}\n\n'); } catch { /* connection already closed */ }
  }, 10_000);
  return () => clearInterval(timer);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sseResult(res: any, data: Record<string, unknown>): void {
  res.write(`data: ${JSON.stringify({ type: "result", ...data })}\n\n`);
  res.end();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sseError(res: any, message: string): void {
  res.write(`data: ${JSON.stringify({ type: "error", error: message })}\n\n`);
  res.end();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sseStatus(res: any, message: string): void {
  try { res.write(`data: ${JSON.stringify({ type: "status", message })}\n\n`); } catch { /* connection closed */ }
}

// ── Retry wrapper ─────────────────────────────────────────────────────────────
// Retries once on transient failures; does not retry auth or validation errors.
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    if (err?.status === 401 || err?.status === 400) throw err;
    return await fn();
  }
}

function generateSlug(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 40);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${base}-${rand}`;
}

function requireAuth(req: any, res: any, next: any) {
  const auth = getAuth(req);
  const userId = auth?.sessionClaims?.userId || auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.userId = userId;
  next();
}

// ── Prompt classifier ─────────────────────────────────────────────────────
// Reads the user description and decides engine (2d/3d) + genre automatically.

function classifyPrompt(prompt: string): { engine: "2d" | "3d"; genre: string } {
  const p = prompt.toLowerCase();

  // Signals that almost certainly mean 3D
  const wants3D =
    /\b(3d|first[\s-]person|fps|first person shooter|space\s+shooter|asteroid|spaceship|galaxy|alien\s+ship|fly\s+through|backrooms|horror\s+maze|dark\s+corridor|haunted\s+house|zombie\s+chase|third[\s-]person)\b/.test(p);

  // Signals that almost certainly mean 2D
  const wants2D =
    /\b(2d|platformer|side[\s-]scroll|side scroll|pixel\s+art|pixel art|top[\s-]down|overhead|retro|arcade|sprite|tile\s+map|tilemap)\b/.test(p);

  // Rule: explicit 2D wins over explicit 3D; both absent → 2D default
  const engine: "2d" | "3d" = wants3D && !wants2D ? "3d" : "2d";

  // Genre for display and (3D) shell selection
  let genre = "Platformer";
  if (/\b(horror|backrooms|monster|scary|haunted|zombie|dark|creepy|fear|ghost|sinister)\b/.test(p)) {
    genre = engine === "3d" ? "FP Horror" : "Horror";
  } else if (/\b(space|asteroid|spaceship|galaxy|alien|stars?|orbit|planet)\b/.test(p)) {
    genre = engine === "3d" ? "Space Shooter" : "Shooter";
  } else if (/\b(race|racing|car|drive|vehicle|track|speed|lap)\b/.test(p)) {
    genre = "Racing";
  } else if (/\b(puzzle|block|push|logic|match|tetris|sokoban|connect)\b/.test(p)) {
    genre = "Puzzle";
  } else if (/\b(shoot|shooter|bullet|enemies?|wave|combat|gun|weapon|blast)\b/.test(p)) {
    genre = engine === "3d" ? "Space Shooter" : "Shooter";
  } else if (/\b(rpg|quest|dungeon|hero|sword|magic|spell|level\s+up)\b/.test(p)) {
    genre = "RPG";
  } else if (/\b(adventure|explore|exploration|open\s+world)\b/.test(p)) {
    genre = "Adventure";
  } else if (/\b(jump|platform|collect|coin|run)\b/.test(p)) {
    genre = "Platformer";
  }

  return { engine, genre };
}

// ── Plan helpers ─────────────────────────────────────────────────────────────

interface GamePlan {
  title: string;
  concept: string;
  playerCharacter: string;
  mainMechanic: string;
  enemies: string;
  levelStructure: string;
  winCondition: string;
  loseCondition: string;
  visualStyle: string;
  features: string[];
}

// Strips markdown code fences and any prose before/after the JSON object,
// since Claude occasionally wraps its output despite being told not to.
function cleanJsonText(text: string): string {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/```(?:json)?/gi, "").trim();
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }
  return cleaned.trim();
}

function parsePlanJson(text: string): GamePlan {
  const raw = cleanJsonText(text);
  try {
    const p = JSON.parse(raw);
    if (typeof p !== "object" || p === null) throw new Error("not an object");
    return {
      title: String(p.title ?? "Untitled Game"),
      concept: String(p.concept ?? ""),
      playerCharacter: String(p.playerCharacter ?? ""),
      mainMechanic: String(p.mainMechanic ?? ""),
      enemies: String(p.enemies ?? ""),
      levelStructure: String(p.levelStructure ?? ""),
      winCondition: String(p.winCondition ?? ""),
      loseCondition: String(p.loseCondition ?? ""),
      visualStyle: String(p.visualStyle ?? ""),
      features: Array.isArray(p.features) ? p.features.map(String) : [],
    };
  } catch {
    // Surface a real error message so callers can tell the user something went wrong
    throw new Error("Plan generation produced invalid JSON — please try again.");
  }
}

function formatApprovedPlan(plan: GamePlan): string {
  return `APPROVED GAME DESIGN DOCUMENT
═══════════════════════════════════════

TITLE: ${plan.title}

CORE CONCEPT:
${plan.concept}

PLAYER CHARACTER:
${plan.playerCharacter}

MAIN MECHANIC:
${plan.mainMechanic}

ENEMIES & CHALLENGES:
${plan.enemies}

LEVEL STRUCTURE:
${plan.levelStructure}

WIN CONDITION: ${plan.winCondition}
LOSE CONDITION: ${plan.loseCondition}

VISUAL STYLE:
${plan.visualStyle}

KEY FEATURES:
${plan.features.map((f: string, i: number) => `${i + 1}. ${f}`).join("\n")}`;
}

const PLAN_SYSTEM_PROMPT = `You are an expert game designer. Generate a detailed, structured game design plan for a browser game.

Output ONLY a valid JSON object with exactly these fields (no markdown, no code fences, no text before or after):
{
  "title": "3-6 word catchy game title",
  "concept": "2-3 sentences: core experience and what makes it unique and fun",
  "playerCharacter": "Who the player is, appearance, special abilities, and movement style",
  "mainMechanic": "The single core action the player performs every second of gameplay",
  "enemies": "2-4 specifically named enemy types with individual behaviors and attack patterns",
  "levelStructure": "Number of levels/areas, how they connect, and how difficulty scales",
  "winCondition": "The exact moment the player wins — what must be achieved",
  "loseCondition": "The exact failure condition — health/lives system, timer, instant death, etc.",
  "visualStyle": "Specific color palette, art style (pixel art/vector/etc.), atmosphere, and mood",
  "features": ["6-8 concrete implemented features as an array of specific strings"]
}

RULES:
- Be SPECIFIC. Never write "various enemies" — name them: "Crawler", "Sentinel", "Boss King".
- Be CREATIVE. Make the title catchy and the concept genuinely interesting.
- Keep each field to 1-3 dense sentences. Be informative, not vague.
- Return ONLY raw JSON. No markdown, no backticks, no code fences, no commentary — your entire response must be parseable by JSON.parse() as-is.`;

const REFINE_SYSTEM_PROMPT = `You are an expert game designer refining a game plan based on user feedback.

Receive: the current plan as JSON + user feedback text.
Output: the updated plan as JSON with the same field structure.

Apply the user's requested changes while keeping everything they didn't mention.
Be SPECIFIC — if they say "make it scarier", add horror elements to concept, enemies, and visual style.
If they say "add multiplayer", note it in mainMechanic and features.

Return ONLY raw JSON. No markdown, no backticks, no code fences, no commentary — your entire response must be parseable by JSON.parse() as-is.`;

// ── Plan generation ───────────────────────────────────────────────────────────

router.post("/games/plan", async (req, res): Promise<void> => {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "CLAUDE_API_KEY is not configured." });
    return;
  }

  const parsed = PlanGameBody.safeParse(req.body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    res.status(400).json({ error: `${issue?.path?.[0] ?? "request"}: ${issue?.message}` });
    return;
  }

  const { prompt } = parsed.data;
  if (prompt.length > MAX_PROMPT_LENGTH) {
    res.status(400).json({ error: `Prompt too long (max ${MAX_PROMPT_LENGTH} chars).` });
    return;
  }

  const { engine, genre } = classifyPrompt(prompt);
  const stopHeartbeat = startSSE(res);
  res.on("close", stopHeartbeat);
  sseStatus(res, "Designing your game plan…");

  try {
    const anthropic = new Anthropic({ apiKey, timeout: 35_000 });
    const plan = await withRetry(async () => {
      const msg = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1200,
        temperature: 0.9,
        system: PLAN_SYSTEM_PROMPT,
        messages: [{
          role: "user",
          content: `Game idea: "${prompt}"\nEngine: ${engine === "3d" ? "Three.js 3D" : "Phaser.js 2D"}\nGenre: ${genre}\n\nGenerate the game design plan.`,
        }],
      });
      const text = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "";
      return parsePlanJson(text);
    });
    req.log.info({ title: plan.title }, "Game plan generated");
    stopHeartbeat();
    sseResult(res, { plan, engine, genre });
  } catch (err: any) {
    stopHeartbeat();
    sseError(res, err?.message ?? "Plan generation failed. Please try again.");
  }
});

// ── Plan refinement ───────────────────────────────────────────────────────────

router.post("/games/plan/refine", async (req, res): Promise<void> => {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "CLAUDE_API_KEY is not configured." });
    return;
  }

  const parsed = RefinePlanBody.safeParse(req.body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    res.status(400).json({ error: `${issue?.path?.[0] ?? "request"}: ${issue?.message}` });
    return;
  }

  const { planJson, feedback } = parsed.data;
  const stopHeartbeat = startSSE(res);
  res.on("close", stopHeartbeat);
  sseStatus(res, "Refining your game plan…");

  try {
    const anthropic = new Anthropic({ apiKey, timeout: 35_000 });
    const plan = await withRetry(async () => {
      const msg = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1200,
        temperature: 0.7,
        system: REFINE_SYSTEM_PROMPT,
        messages: [{
          role: "user",
          content: `CURRENT PLAN:\n${planJson}\n\nUSER FEEDBACK:\n${feedback}`,
        }],
      });
      const text = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "";
      return parsePlanJson(text);
    });
    req.log.info({ title: plan.title }, "Game plan refined");
    stopHeartbeat();
    sseResult(res, { plan });
  } catch (err: any) {
    stopHeartbeat();
    sseError(res, err?.message ?? "Plan refinement failed. Please try again.");
  }
});

// ── AI Generation ──────────────────────────────────────────────────────────

router.post("/games/generate", async (req, res): Promise<void> => {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    req.log.error("CLAUDE_API_KEY is not set");
    res.status(500).json({ error: "CLAUDE_API_KEY is not configured. Please add it in the Secrets tab." });
    return;
  }

  const parsed = GenerateGameBody.safeParse(req.body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const field = firstIssue?.path?.[0] ?? "request";
    const msg = firstIssue?.message ?? "Invalid request";
    res.status(400).json({ error: `${field}: ${msg}` });
    return;
  }

  const { prompt, approvedPlan: approvedPlanJson } = parsed.data;

  if (prompt.length > MAX_PROMPT_LENGTH) {
    res.status(400).json({ error: `Prompt too long. Max ${MAX_PROMPT_LENGTH} characters.` });
    return;
  }

  // If the caller provided an approved plan JSON, format it into readable text
  let formattedPlan: string | undefined;
  if (approvedPlanJson) {
    try {
      const planObj = JSON.parse(approvedPlanJson);
      formattedPlan = formatApprovedPlan(planObj);
    } catch {
      formattedPlan = approvedPlanJson; // treat as raw text if not valid JSON
    }
    req.log.info({ planLen: formattedPlan.length }, "Using pre-approved game plan");
  }

  // Auto-classify: ignore any client-sent genre/engine; Claude decides.
  const { engine, genre } = classifyPrompt(prompt);
  const is3D = engine === "3d";

  req.log.info({ genre, engine, promptLength: prompt.length, hasPlan: !!formattedPlan }, "Generating game with Claude (auto-classified)");

  // All validation passed — switch to SSE so the connection stays alive
  // during the long Claude generation (heartbeat every 10 s).
  const stopHeartbeat = startSSE(res);
  // Guarantee cleanup if the client disconnects before we finish
  res.on("close", stopHeartbeat);

  try {
    if (is3D) {
      const result = await withRetry(() => generate3DGame(apiKey, prompt, genre, req.log, (msg) => sseStatus(res, msg), formattedPlan));
      req.log.info({ title: result.title }, "3D game generated successfully");
      stopHeartbeat();
      sseResult(res, { ...result, engine, genre });
      return;
    }

    const result = await generate2DGame(apiKey, prompt, genre, req.log, (msg) => sseStatus(res, msg), formattedPlan);
    stopHeartbeat();
    sseResult(res, {
      gameCode: result.gameCode,
      title: result.title,
      engine,
      genre,
      qualityScore: result.qualityScore,
      gamePlan: result.gamePlan,
      needsSpriteGeneration: result.needsSpriteGeneration,
      gameContextJson: result.gameContext ? JSON.stringify(result.gameContext) : undefined,
    });
  } catch (err) {
    stopHeartbeat();
    const error = err as Error & { status?: number };
    req.log.error({ err }, "Claude API call failed");
    let message = error.message ?? "Game generation failed. Please try again.";
    if (error.status === 401) message = "Invalid Claude API key.";
    else if (error.status === 429) message = "Claude rate limit reached. Please wait a moment and try again.";
    sseError(res, message);
  }
});

// ── Public Game Listing ───────────────────────────────────────────────────

// ── Record Play ──────────────────────────────────────────────────────────────

router.post("/games/:id/play", async (req: any, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid game id" }); return; }

  // Server-side dedup: one count per IP per game per 5 minutes
  const ip = req.headers["x-forwarded-for"]?.toString().split(",")[0].trim() ?? req.socket.remoteAddress ?? "unknown";
  if (!throttlePlay(ip, id)) {
    // Already counted recently — return current count without incrementing
    const [row] = await db.select({ playCount: gamesTable.playCount }).from(gamesTable).where(eq(gamesTable.id, id));
    res.json({ playCount: row?.playCount ?? 0 });
    return;
  }

  await db
    .update(gamesTable)
    .set({ playCount: sql`${gamesTable.playCount} + 1` })
    .where(and(eq(gamesTable.id, id), eq(gamesTable.status, "published")));
  const [row] = await db
    .select({ playCount: gamesTable.playCount })
    .from(gamesTable)
    .where(eq(gamesTable.id, id));
  res.json({ playCount: row?.playCount ?? 0 });
});

router.get("/games/public", async (req, res): Promise<void> => {
  const params = ListPublicGamesQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { genre, search, sort = "newest", limit = 20, offset = 0 } = params.data;

  const whereClause =
    genre && search
      ? and(eq(gamesTable.status, "published"), eq(gamesTable.genre, genre), ilike(gamesTable.title, `%${search}%`))
      : genre
      ? and(eq(gamesTable.status, "published"), eq(gamesTable.genre, genre))
      : search
      ? and(eq(gamesTable.status, "published"), ilike(gamesTable.title, `%${search}%`))
      : eq(gamesTable.status, "published");

  const orderExpr =
    sort === "popular" ? [desc(gamesTable.playCount), desc(gamesTable.createdAt)]
    : sort === "top_rated" ? [sql`average_rating DESC NULLS LAST`, desc(gamesTable.ratingCount), desc(gamesTable.createdAt)]
    : sort === "trending" ? [sql`(play_count * 10 + likes_count * 3) DESC`, desc(gamesTable.createdAt)]
    : [desc(gamesTable.createdAt)]; // newest default

  const games = await db
    .select({
      id: gamesTable.id,
      title: gamesTable.title,
      genre: gamesTable.genre,
      status: gamesTable.status,
      slug: gamesTable.slug,
      likesCount: gamesTable.likesCount,
      playCount: gamesTable.playCount,
      ratingCount: gamesTable.ratingCount,
      averageRating: gamesTable.averageRating,
      authorId: gamesTable.authorId,
      authorName: gamesTable.authorName,
      createdAt: gamesTable.createdAt,
      coverImageUrl: gamesTable.coverImageUrl,
    })
    .from(gamesTable)
    .where(whereClause)
    .orderBy(...orderExpr)
    .limit(limit)
    .offset(offset);

  res.json(games);
});

// ── User's Own Games ──────────────────────────────────────────────────────

router.get("/games/my", requireAuth, async (req: any, res): Promise<void> => {
  const games = await db
    .select({
      id: gamesTable.id,
      title: gamesTable.title,
      genre: gamesTable.genre,
      status: gamesTable.status,
      slug: gamesTable.slug,
      likesCount: gamesTable.likesCount,
      authorId: gamesTable.authorId,
      authorName: gamesTable.authorName,
      createdAt: gamesTable.createdAt,
      coverImageUrl: gamesTable.coverImageUrl,
    })
    .from(gamesTable)
    .where(eq(gamesTable.authorId, req.userId))
    .orderBy(desc(gamesTable.createdAt));

  res.json(games);
});

// ── Save Draft ────────────────────────────────────────────────────────────

router.post("/games", requireAuth, async (req: any, res): Promise<void> => {
  const parsed = SaveGameBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const auth = getAuth(req);
  const user = auth?.sessionClaims;
  const authorName =
    (user?.["firstName"] as string ?? "") + " " + (user?.["lastName"] as string ?? "");
  const displayName = authorName.trim() || (user?.["email"] as string) || "Anonymous";

  const slug = generateSlug(parsed.data.title);
  const [game] = await db
    .insert(gamesTable)
    .values({
      ...parsed.data,
      generationStatus: parsed.data.generationStatus ?? "complete",
      status: "draft",
      slug,
      authorId: req.userId,
      authorName: displayName,
    })
    .returning();

  res.status(201).json(game);

  // Fire-and-forget cover generation — pass gameContext so the cover matches the game world
  if (process.env.REPLICATE_API_KEY) {
    generateAndSaveCover(game.id, game.title, game.genre, game.gameContext ?? undefined).catch((err: unknown) => {
      req.log.warn({ err, gameId: game.id }, "Auto cover generation failed (non-blocking)");
    });
  }
});

// ── Get by Slug (public shareable URL — published only) ───────────────────

router.get("/games/slug/:slug", async (req, res): Promise<void> => {
  const params = GetGameBySlugParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [game] = await db
    .select()
    .from(gamesTable)
    .where(and(eq(gamesTable.slug, params.data.slug), eq(gamesTable.status, "published")));

  if (!game) {
    res.status(404).json({ error: "Game not found" });
    return;
  }

  res.json(game);
});

// ── Get by ID (owner sees draft; others only see published) ───────────────

router.get("/games/:id", async (req, res): Promise<void> => {
  const params = GetGameParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [game] = await db
    .select()
    .from(gamesTable)
    .where(eq(gamesTable.id, params.data.id));

  if (!game) {
    res.status(404).json({ error: "Game not found" });
    return;
  }

  // Drafts are private — only the author may fetch them
  if (game.status === "draft") {
    const auth = getAuth(req);
    const requesterId = auth?.sessionClaims?.userId || auth?.userId;
    if (!requesterId || requesterId !== game.authorId) {
      res.status(404).json({ error: "Game not found" });
      return;
    }
  }

  res.json(game);
});

// ── Update (patch code/title) ─────────────────────────────────────────────

router.patch("/games/:id", requireAuth, async (req: any, res): Promise<void> => {
  const params = UpdateGameParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = UpdateGameBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(gamesTable)
    .where(and(eq(gamesTable.id, params.data.id), eq(gamesTable.authorId, req.userId)));

  if (!existing) {
    res.status(404).json({ error: "Game not found" });
    return;
  }

  const updates: Partial<typeof existing> = {};
  if (body.data.title !== undefined) updates.title = body.data.title;
  if (body.data.gameCode !== undefined) {
    updates.gameCode = body.data.gameCode;
    updates.currentCode = body.data.gameCode; // keep live version in sync with manual saves
  }
  if (body.data.spritesJson !== undefined) updates.spritesJson = body.data.spritesJson ?? null;
  if (body.data.generationStatus !== undefined) updates.generationStatus = body.data.generationStatus;

  const [updated] = await db
    .update(gamesTable)
    .set(updates)
    .where(eq(gamesTable.id, params.data.id))
    .returning();

  res.json(updated);
});

// ── Publish ───────────────────────────────────────────────────────────────

router.post("/games/:id/publish", requireAuth, async (req: any, res): Promise<void> => {
  const params = PublishGameParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(gamesTable)
    .where(and(eq(gamesTable.id, params.data.id), eq(gamesTable.authorId, req.userId)));

  if (!existing) {
    res.status(404).json({ error: "Game not found" });
    return;
  }

  const [published] = await db
    .update(gamesTable)
    .set({ status: "published" })
    .where(eq(gamesTable.id, params.data.id))
    .returning();

  res.json(published);
});

// ── Background Sprite Generation (SSE) ───────────────────────────────────
// Generates pixel-art sprites for a saved game in the background.
// Emits {type:"sprite_ready"} for each sprite as it completes; each sprite
// is also immediately persisted to the DB so partial progress survives disconnects.

router.post("/games/:id/generate-sprites", requireAuth, async (req: any, res): Promise<void> => {
  const params = GetGameParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid game ID" });
    return;
  }

  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey || !process.env.REPLICATE_API_KEY) {
    res.status(503).json({ error: "Image generation not configured" });
    return;
  }

  const [game] = await db
    .select()
    .from(gamesTable)
    .where(and(eq(gamesTable.id, params.data.id), eq(gamesTable.authorId, req.userId)));

  if (!game) {
    res.status(404).json({ error: "Game not found" });
    return;
  }

  if (!game.gamePlan) {
    res.status(400).json({ error: "Game has no design document — cannot generate sprites" });
    return;
  }

  // Atomically claim the generation job — prevents concurrent duplicate runs.
  // Allow: sprites_pending, sprites_error, complete (explicit re-run).
  // Reject: generating (already in progress).
  const [claimed] = await db
    .update(gamesTable)
    .set({ generationStatus: "generating" })
    .where(
      and(
        eq(gamesTable.id, game.id),
        sql`${gamesTable.generationStatus} != 'generating'`,
      ),
    )
    .returning({ id: gamesTable.id });

  if (!claimed) {
    res.status(409).json({ error: "Sprite generation already in progress for this game" });
    return;
  }

  const stopHeartbeat = startSSE(res);
  res.on("close", stopHeartbeat);

  try {
    const allSprites: Array<{ name: string; url: string; objectPath: string; description: string }> = [];

    const { sprites, backgroundSprite } = await generateSpritesForGame(
      apiKey,
      game.gamePlan,
      game.prompt,
      game.gameContext,
      (msg) => sseStatus(res, msg),
      async (sprite) => {
        // Persist immediately — read fresh spritesJson to avoid race conditions
        try {
          const [current] = await db
            .select({ sj: gamesTable.spritesJson })
            .from(gamesTable)
            .where(eq(gamesTable.id, game.id));
          const existing: Array<{ name: string; url: string; description: string }> =
            current?.sj ? JSON.parse(current.sj) : [];
          const updated = [
            ...existing.filter((s) => s.name !== sprite.name),
            { name: sprite.name, url: sprite.objectPath, description: sprite.description },
          ];
          await db
            .update(gamesTable)
            .set({ spritesJson: JSON.stringify(updated) })
            .where(eq(gamesTable.id, game.id));
        } catch (dbErr) {
          req.log.warn({ dbErr, spriteName: sprite.name }, "Sprite DB update failed (non-critical)");
        }

        allSprites.push({ name: sprite.name, url: sprite.url, objectPath: sprite.objectPath, description: sprite.description });

        // Emit to client (ignore if connection already closed)
        if (!res.writableEnded) {
          try {
            res.write(`data: ${JSON.stringify({
              type: "sprite_ready",
              name: sprite.name,
              url: sprite.url,
              objectPath: sprite.objectPath,
              description: sprite.description,
            })}\n\n`);
          } catch { /* client disconnected */ }
        }
      },
    );

    // Mark generation complete
    await db
      .update(gamesTable)
      .set({ generationStatus: "complete" })
      .where(eq(gamesTable.id, game.id));

    stopHeartbeat();
    sseResult(res, { sprites, backgroundSprite });
  } catch (err) {
    // Reset to sprites_error so the user can retry
    await db
      .update(gamesTable)
      .set({ generationStatus: "sprites_error" })
      .where(eq(gamesTable.id, game.id))
      .catch(() => {/* ignore secondary failure */});
    stopHeartbeat();
    const message = (err as Error)?.message ?? "Sprite generation failed";
    req.log.error({ err }, "generate-sprites route error");
    sseError(res, message);
  }
});

// ── Delete ────────────────────────────────────────────────────────────────

router.delete("/games/:id", requireAuth, async (req: any, res): Promise<void> => {
  const params = DeleteGameParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(gamesTable)
    .where(and(eq(gamesTable.id, params.data.id), eq(gamesTable.authorId, req.userId)));

  if (!existing) {
    res.status(404).json({ error: "Game not found" });
    return;
  }

  await db.delete(gamesTable).where(eq(gamesTable.id, params.data.id));
  res.sendStatus(204);
});

// ── Like / Unlike ─────────────────────────────────────────────────────────

router.post("/games/:id/like", requireAuth, async (req: any, res): Promise<void> => {
  const params = ToggleLikeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [game] = await db
    .select()
    .from(gamesTable)
    .where(eq(gamesTable.id, params.data.id));

  if (!game) {
    res.status(404).json({ error: "Game not found" });
    return;
  }

  const [existingLike] = await db
    .select()
    .from(likesTable)
    .where(and(eq(likesTable.userId, req.userId), eq(likesTable.gameId, params.data.id)));

  let liked: boolean;
  let newCount: number;

  if (existingLike) {
    await db.delete(likesTable).where(eq(likesTable.id, existingLike.id));
    const [updated] = await db
      .update(gamesTable)
      .set({ likesCount: sql`${gamesTable.likesCount} - 1` })
      .where(eq(gamesTable.id, params.data.id))
      .returning({ likesCount: gamesTable.likesCount });
    liked = false;
    newCount = Math.max(0, updated?.likesCount ?? 0);
  } else {
    await db.insert(likesTable).values({ userId: req.userId, gameId: params.data.id });
    const [updated] = await db
      .update(gamesTable)
      .set({ likesCount: sql`${gamesTable.likesCount} + 1` })
      .where(eq(gamesTable.id, params.data.id))
      .returning({ likesCount: gamesTable.likesCount });
    liked = true;
    newCount = updated?.likesCount ?? 0;
  }

  res.json({ liked, likesCount: newCount });
});

// ── Chat helpers ──────────────────────────────────────────────────────────────

/** Extract the HTML body and optional CHANGE: summary from Claude's raw response. */
function extractHtmlAndSummary(rawFull: string): { html: string; changeSummary: string | undefined } {
  const htmlCloseLower = rawFull.toLowerCase().lastIndexOf("</html>");
  const htmlEnd = htmlCloseLower !== -1 ? htmlCloseLower + 7 : -1;

  // CHANGE: summary must only come from the tail after </html>
  let changeSummary: string | undefined;
  if (htmlEnd !== -1) {
    const tail = rawFull.slice(htmlEnd).trim();
    const m = tail.match(/^CHANGE:\s*(.+)$/m);
    if (m?.[1]) changeSummary = m[1].trim();
  }

  const html = htmlEnd !== -1 ? rawFull.slice(0, htmlEnd) : rawFull.trim();
  return { html, changeSummary };
}

/** Validate that Claude's returned HTML is a complete, working game. */
function validateChatHtml(html: string, isPhaser: boolean): string | null {
  if (!html.trimStart().startsWith("<")) return "Response is not valid HTML";
  // Must contain a closing </html> — truncated responses won't have it
  if (!html.toLowerCase().includes("</html>")) return "Response is truncated (missing </html>)";
  const nonEmpty = html.split("\n").filter((l) => l.trim().length > 0).length;
  if (nonEmpty < 80) return `Code too short: ${nonEmpty} non-empty lines (need 80+)`;
  if (isPhaser) {
    if (!html.includes("Phaser.Scene")) return "Missing Phaser.Scene class";
    if (!/create\s*\(/.test(html)) return "Missing create() function";
    if (!/update\s*\(/.test(html)) return "Missing update() function";
    // Three.js shells legitimately use document.getElementById/createElement for
    // their HUD/canvas boilerplate, so only enforce this for Phaser games.
    if (/document\.(querySelector|getElementById|createElement)/.test(html))
      return "Uses HTML/DOM APIs for interaction — use Phaser input events instead";
  }
  // A literal <button> is never legitimate gameplay interaction in either engine.
  if (/<button[\s>]/i.test(html)) return "Contains an HTML <button> element — use engine input events instead";
  return null;
}

// ── AI Chat Editor ───────────────────────────────────────────────────────────

const CHAT_SYSTEM_PROMPT = [
  "You are an expert game developer who built this specific game. You have complete understanding of every line of code. When the user asks for a change:",
  "- Think about how the change fits into the existing code structure",
  "- Make the change in a way that feels polished and fun, not just the minimum edit",
  "- If the user asks for something vague like 'make it better' or 'make it more fun', use your judgment to add something genuinely interesting",
  "- If the user asks for something that would break the game, do it in a safe way and explain what you did differently",
  "- Always return the complete full game code with the change applied",
  "- Never return partial code. Never use placeholders. Always return a complete working game.",
  "- NEVER use HTML/DOM APIs for gameplay interaction (no document.querySelector, no HTML <button>/<div> click handlers, no createElement). Every in-game action — Start, Restart, Play Again, menu selection, etc. — MUST be wired through the game engine's own input system (Phaser: this.input.keyboard / this.input.on('pointerdown', ...); Three.js: the existing keys{} object or canvas pointer listeners). If the existing code already has an HTML button controlling gameplay, replace it with the equivalent engine-native input listener.",
  "",
  "Output format:",
  "1. The first character of your response must be '<' and it must start with '<!DOCTYPE html>' — no markdown fences, no prose before the HTML.",
  "2. Return the complete, working updated HTML game code.",
  "3. After the closing </html> tag, on a new line write exactly: CHANGE: [one sentence describing precisely what you changed, e.g. 'Increased player speed from 200 to 350 and added a double jump on pressing W']",
].join("\n");

const MAX_CHAT_MESSAGE_CHARS = 2_000;
const MAX_CHAT_CODE_CHARS = 80_000;

router.post("/games/:id/chat", requireAuth, async (req, res): Promise<void> => {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "CLAUDE_API_KEY is not configured." });
    return;
  }

  const params = ChatEditGameParams.safeParse({ id: req.params.id });
  if (!params.success) {
    res.status(400).json({ error: "Invalid game id" });
    return;
  }

  const body = ChatEditGameBody.safeParse(req.body);
  if (!body.success) {
    const first = body.error.issues[0];
    res.status(400).json({ error: `${first?.path?.[0] ?? "request"}: ${first?.message}` });
    return;
  }

  const { message } = body.data;

  if (message.length > MAX_CHAT_MESSAGE_CHARS) {
    res.status(400).json({ error: `Message too long. Max ${MAX_CHAT_MESSAGE_CHARS} characters.` });
    return;
  }

  // Fetch full game record — currentCode is the DB-tracked authoritative live version
  const [game] = await db
    .select({
      id: gamesTable.id,
      authorId: gamesTable.authorId,
      gameCode: gamesTable.gameCode,
      currentCode: gamesTable.currentCode,
      codeVersion: gamesTable.codeVersion,
    })
    .from(gamesTable)
    .where(eq(gamesTable.id, params.data.id));

  if (!game) {
    res.status(404).json({ error: "Game not found" });
    return;
  }
  if (game.authorId !== (req as any).userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // Always use DB's live code — every edit builds on the correct latest version,
  // not the original generated code or a stale client snapshot.
  const liveCode = game.currentCode ?? game.gameCode;
  const isPhaser = liveCode.includes("Phaser");

  const codeContext = liveCode.length > MAX_CHAT_CODE_CHARS
    ? liveCode.slice(0, MAX_CHAT_CODE_CHARS) + "\n<!-- [truncated] -->"
    : liveCode;

  req.log.info(
    { gameId: params.data.id, messageLength: message.length, codeVersion: game.codeVersion },
    "AI chat edit requested",
  );

  const anthropic = new Anthropic({ apiKey, timeout: 120_000 });
  const userPrompt = `Here is the current game code:\n\n${codeContext}\n\n---\n\nThe user wants this change: ${message}\n\nMake this specific change and return the complete updated working HTML game code only:`;

  // All validation passed — switch to SSE so the connection stays alive
  const stopHeartbeat = startSSE(res);
  // Guarantee cleanup if the client disconnects before we finish
  res.on("close", stopHeartbeat);

  // Inner function that runs both Claude attempts and returns the final HTML
  async function runChatEdit(): Promise<{ html: string; changeSummary: string | undefined }> {
    // ── Attempt 1 ──────────────────────────────────────────────────────────
    const r1 = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 16000,
      temperature: 0.9,
      system: CHAT_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });
    const rawFull1 = r1.content[0]?.type === "text" ? r1.content[0].text.trim() : "";
    const { html: html1, changeSummary: cs1 } = extractHtmlAndSummary(rawFull1);

    const truncated1 = r1.stop_reason === "max_tokens";
    let failure = truncated1 ? "Response was cut off (output too long)" : validateChatHtml(html1, isPhaser);

    if (!failure) return { html: html1, changeSummary: cs1 };

    // ── Attempt 2 — correction round-trip ──────────────────────────────────
    req.log.warn({ gameId: params.data?.id, failure }, "Chat attempt 1 invalid — sending correction");

    const r2 = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 16000,
      temperature: 0.9,
      system: CHAT_SYSTEM_PROMPT,
      messages: [
        { role: "user", content: userPrompt },
        { role: "assistant", content: rawFull1 },
        {
          role: "user",
          content: `That code was invalid. Here is what was wrong: ${failure}. Please fix it and return the complete working HTML game code.`,
        },
      ],
    });
    const rawFull2 = r2.content[0]?.type === "text" ? r2.content[0].text.trim() : "";
    const { html: html2, changeSummary: cs2 } = extractHtmlAndSummary(rawFull2);

    const truncated2 = r2.stop_reason === "max_tokens";
    failure = truncated2 ? "Response was cut off (output too long)" : validateChatHtml(html2, isPhaser);

    if (failure) {
      req.log.error({ gameId: params.data!.id, failure }, "Chat correction also invalid — rejecting change");
      throw new Error(`Could not apply this change after 2 attempts (${failure}). Your game is unchanged — try rephrasing your request.`);
    }
    return { html: html2, changeSummary: cs2 };
  }

  try {
    const { html: finalHtml, changeSummary: finalChangeSummary } = await withRetry(runChatEdit);

    // ── Persist to DB ───────────────────────────────────────────────────────
    const updatedCode = finalHtml;
    const newVersion = (game.codeVersion ?? 0) + 1;

    await db
      .update(gamesTable)
      .set({ currentCode: updatedCode, codeVersion: newVersion })
      .where(eq(gamesTable.id, params.data.id));

    req.log.info(
      { gameId: params.data.id, chars: updatedCode.length, codeVersion: newVersion },
      "AI chat edit applied",
    );
    stopHeartbeat();
    sseResult(res, { updatedCode, changeSummary: finalChangeSummary, codeVersion: newVersion });
  } catch (err: any) {
    stopHeartbeat();
    req.log.error({ err, gameId: params.data.id }, "AI chat edit failed");
    sseError(res, err?.message ?? "AI edit failed. Please try again.");
  }
});

export default router;
