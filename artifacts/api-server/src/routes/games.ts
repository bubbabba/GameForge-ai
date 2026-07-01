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
} from "@workspace/api-zod";
import { generate3DGame } from "../lib/generate3d";

const router: IRouter = Router();

const GENRE_HINTS: Record<string, string> = {
  Platformer: "side-scrolling platform game with jumping mechanics, platforms, and gravity physics",
  Horror: "dark atmospheric horror game with tension, scares, and eerie visuals",
  Shooter: "shooting game where the player can fire projectiles at enemies",
  Puzzle: "puzzle game that requires logic and thinking to solve challenges",
  Racing: "top-down or side-view racing game with speed and obstacles",
  RPG: "role-playing game with character stats, exploration, and combat",
  Adventure: "exploration adventure game with discovery and story elements",
  Fantasy: "fantasy world game with magic, creatures, and epic quests",
};

const MAX_PROMPT_LENGTH = 1000;

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
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { prompt, genre, engine } = parsed.data;
  const is3D = engine === "3d";

  if (prompt.length > MAX_PROMPT_LENGTH) {
    res.status(400).json({ error: `Prompt too long. Max ${MAX_PROMPT_LENGTH} characters.` });
    return;
  }

  req.log.info({ genre, engine: engine ?? "2d", promptLength: prompt.length }, "Generating game with Claude");

  try {
    // ── 3D path: inject Claude logic into a hardcoded Three.js shell ──────
    if (is3D) {
      const result = await generate3DGame(apiKey, prompt, genre);
      req.log.info({ title: result.title }, "3D game generated successfully");
      res.json(result);
      return;
    }

    // ── 2D path: full Phaser.js HTML generation ───────────────────────────
    const genreHint = GENRE_HINTS[genre] ?? genre;

    const phaser2DPrompt = [
      "You are an expert Phaser.js game developer. Generate a complete, self-contained, playable browser game using Phaser 3.",
      "",
      `User's game description: "${prompt}"`,
      `Genre: ${genre} (${genreHint})`,
      "",
      "REQUIREMENTS:",
      "1. Output ONLY a complete HTML document — no explanations, no markdown, no code blocks, just raw HTML starting with <!DOCTYPE html>",
      "2. Use Phaser 3 from CDN: https://cdn.jsdelivr.net/npm/phaser@3.60.0/dist/phaser.min.js",
      "3. The game must be fully self-contained in the HTML — all JavaScript inline in a <script> tag",
      "4. Game canvas must be exactly 800x500 pixels",
      "5. Include proper game mechanics matching the genre",
      "6. Add keyboard controls (arrow keys, WASD, or spacebar as appropriate)",
      "7. Include a score or lives system where applicable",
      "8. Add game over / win conditions",
      "9. Use colorful, visually appealing graphics drawn with Phaser's built-in graphics API (no external image assets needed)",
      "10. Make the game actually fun and playable",
      "11. Add on-screen instructions (small text showing controls)",
      "12. Set document body background to #090909 (dark) and center the canvas",
      "",
      `Genre guidance for ${genre}: ${genreHint}`,
      "",
      "Generate the complete HTML game now. Start immediately with <!DOCTYPE html>",
    ].join("\n");

    const anthropic = new Anthropic({ apiKey });
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 8192,
      messages: [{ role: "user", content: phaser2DPrompt }],
    });

    const content = message.content[0];
    if (!content || content.type !== "text") {
      res.status(500).json({ error: "Unexpected response format from Claude" });
      return;
    }

    let gameCode = content.text.trim();
    if (gameCode.startsWith("```")) {
      gameCode = gameCode.replace(/^```(?:html)?\n?/, "").replace(/\n?```$/, "").trim();
    }

    const titleWords = prompt.split(" ").slice(0, 5)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    const title = `${titleWords} (${genre})`;

    req.log.info({ title }, "2D game generated successfully");
    res.json({ gameCode, title });
  } catch (err) {
    const error = err as Error & { status?: number };
    req.log.error({ err }, "Claude API call failed");
    if (error.status === 401) {
      res.status(500).json({ error: "Invalid Claude API key." });
      return;
    }
    if (error.status === 429) {
      res.status(500).json({ error: "Claude rate limit reached. Please wait and try again." });
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
  if (body.data.gameCode !== undefined) updates.gameCode = body.data.gameCode;

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

export default router;
