import { Router, type IRouter } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { getAuth } from "@clerk/express";
import { eq, and, desc, ilike, sql } from "drizzle-orm";
import { db, gamesTable, likesTable } from "@workspace/db";
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
} from "@workspace/api-zod";
import { generate3DGame } from "../lib/generate3d";
import { generate2DGame } from "../lib/generate2d";
import { generateAndSaveCover } from "../lib/imageGeneration";

const router: IRouter = Router();

const MAX_PROMPT_LENGTH = 4000;

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

  const { prompt } = parsed.data;

  if (prompt.length > MAX_PROMPT_LENGTH) {
    res.status(400).json({ error: `Prompt too long. Max ${MAX_PROMPT_LENGTH} characters.` });
    return;
  }

  // Auto-classify: ignore any client-sent genre/engine; Claude decides.
  const { engine, genre } = classifyPrompt(prompt);
  const is3D = engine === "3d";

  req.log.info({ genre, engine, promptLength: prompt.length }, "Generating game with Claude (auto-classified)");

  try {
    // ── 3D path: inject Claude logic into a hardcoded Three.js shell ──────
    if (is3D) {
      const result = await generate3DGame(apiKey, prompt, genre, req.log);
      req.log.info({ title: result.title }, "3D game generated successfully");
      res.json({ ...result, engine, genre });
      return;
    }

    // ── 2D path: two-step Phaser.js generation ────────────────────────────
    const result = await generate2DGame(apiKey, prompt, genre, req.log);
    res.json({
      gameCode: result.gameCode,
      title: result.title,
      engine,
      genre,
      qualityScore: result.qualityScore,
      gamePlan: result.gamePlan,
    });
  } catch (err) {
    const error = err as Error & { status?: number };
    req.log.error({ err }, "Claude API call failed");
    if (error.status === 401) {
      res.status(500).json({ error: "Invalid Claude API key." });
      return;
    }
    if (error.status === 429) {
      res.status(500).json({ error: "Claude rate limit reached. Please wait a moment and try again." });
      return;
    }
    res.status(500).json({ error: error.message ?? "Game generation failed. Please try again." });
  }
});

// ── Public Game Listing ───────────────────────────────────────────────────

router.get("/games/public", async (req, res): Promise<void> => {
  const params = ListPublicGamesQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { genre, search, limit = 20, offset = 0 } = params.data;

  let query = db
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
    .where(
      genre && search
        ? and(
            eq(gamesTable.status, "published"),
            eq(gamesTable.genre, genre),
            ilike(gamesTable.title, `%${search}%`),
          )
        : genre
        ? and(eq(gamesTable.status, "published"), eq(gamesTable.genre, genre))
        : search
        ? and(eq(gamesTable.status, "published"), ilike(gamesTable.title, `%${search}%`))
        : eq(gamesTable.status, "published"),
    )
    .orderBy(desc(gamesTable.createdAt))
    .limit(limit)
    .offset(offset);

  const games = await query;
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
      status: "draft",
      slug,
      authorId: req.userId,
      authorName: displayName,
    })
    .returning();

  res.status(201).json(game);

  // Fire-and-forget cover generation — does not block the response
  if (process.env.REPLICATE_API_KEY) {
    generateAndSaveCover(game.id, game.title, game.genre).catch((err: unknown) => {
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
  }
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

  const anthropic = new Anthropic({ apiKey });
  const userPrompt = `Here is the current game code:\n\n${codeContext}\n\n---\n\nThe user wants this change: ${message}\n\nMake this specific change and return the complete updated working HTML game code only:`;

  try {
    // ── Attempt 1 ────────────────────────────────────────────────────────────
    const r1 = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 16000,
      temperature: 0.9,
      system: CHAT_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });
    const rawFull1 = r1.content[0]?.type === "text" ? r1.content[0].text.trim() : "";
    const { html: html1, changeSummary: cs1 } = extractHtmlAndSummary(rawFull1);

    // Treat a token-limit cut-off as an immediate validation failure
    const truncated1 = r1.stop_reason === "max_tokens";
    let failure = truncated1 ? "Response was cut off (output too long)" : validateChatHtml(html1, isPhaser);
    let finalHtml = html1;
    let finalChangeSummary = cs1;

    // ── Attempt 2 — correction round-trip if Attempt 1 failed ───────────────
    if (failure) {
      req.log.warn({ gameId: params.data.id, failure }, "Chat attempt 1 invalid — sending correction");

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
      finalHtml = html2;
      finalChangeSummary = cs2;

      if (failure) {
        req.log.error({ gameId: params.data.id, failure }, "Chat correction also invalid — rejecting change");
        res.status(422).json({
          error: `Could not apply this change after 2 attempts (${failure}). Your game is unchanged — try rephrasing your request.`,
        });
        return;
      }
    }

    // ── Persist to DB ─────────────────────────────────────────────────────────
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
    res.json({ updatedCode, changeSummary: finalChangeSummary, codeVersion: newVersion });
  } catch (err: any) {
    req.log.error({ err, gameId: params.data.id }, "AI chat edit failed");
    res.status(500).json({ error: "AI edit failed. Please try again." });
  }
});

export default router;
