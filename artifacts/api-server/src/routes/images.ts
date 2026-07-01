import { Router } from "express";
import { getAuth } from "@clerk/express";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db, gamesTable } from "@workspace/db";
import { generateAndSaveCover, generateSprite } from "../lib/imageGeneration";

const router: Router = Router();

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

const ImageGameParams = z.object({ id: z.coerce.number() });
const GenerateSpriteBody = z.object({ description: z.string().min(1).max(500) });

// ── Generate cover ────────────────────────────────────────────────────────────

router.post("/games/:id/generate-cover", requireAuth, async (req: any, res): Promise<void> => {
  if (!process.env.REPLICATE_API_KEY) {
    res.status(503).json({
      error: "REPLICATE_API_KEY is not configured. Add it to your Replit Secrets.",
    });
    return;
  }

  const params = ImageGameParams.safeParse({ id: req.params.id });
  if (!params.success) {
    res.status(400).json({ error: "Invalid game id" });
    return;
  }

  const [game] = await db
    .select({
      id: gamesTable.id,
      authorId: gamesTable.authorId,
      title: gamesTable.title,
      genre: gamesTable.genre,
      gameContext: gamesTable.gameContext,
    })
    .from(gamesTable)
    .where(and(eq(gamesTable.id, params.data.id), eq(gamesTable.authorId, req.userId)));

  if (!game) {
    res.status(404).json({ error: "Game not found" });
    return;
  }

  try {
    // Pass stored gameContext so the cover matches the actual game world
    const coverImageUrl = await generateAndSaveCover(game.id, game.title, game.genre, game.gameContext);
    req.log.info({ gameId: game.id }, "Cover generated and saved");
    res.json({ coverImageUrl });
  } catch (err: any) {
    req.log.error({ err, gameId: game.id }, "Cover generation failed");
    res.status(500).json({ error: "Cover generation failed. Please try again." });
  }
});

// ── Generate sprite ───────────────────────────────────────────────────────────

router.post("/games/:id/generate-sprite", requireAuth, async (req: any, res): Promise<void> => {
  if (!process.env.REPLICATE_API_KEY) {
    res.status(503).json({
      error: "REPLICATE_API_KEY is not configured. Add it to your Replit Secrets.",
    });
    return;
  }

  const params = ImageGameParams.safeParse({ id: req.params.id });
  if (!params.success) {
    res.status(400).json({ error: "Invalid game id" });
    return;
  }

  const body = GenerateSpriteBody.safeParse(req.body);
  if (!body.success) {
    const first = body.error.issues[0];
    res.status(400).json({ error: `${first?.path?.[0] ?? "request"}: ${first?.message}` });
    return;
  }

  // Fetch game context so the new sprite matches the original game world
  const [game] = await db
    .select({
      id: gamesTable.id,
      authorId: gamesTable.authorId,
      gameContext: gamesTable.gameContext,
    })
    .from(gamesTable)
    .where(and(eq(gamesTable.id, params.data.id), eq(gamesTable.authorId, req.userId)));

  if (!game) {
    res.status(404).json({ error: "Game not found" });
    return;
  }

  try {
    // Include full game context so regenerated sprite fits the original world
    const spriteUrl = await generateSprite(body.data.description, game.gameContext);
    req.log.info({ gameId: game.id }, "Sprite generated");
    res.json({ spriteUrl });
  } catch (err: any) {
    req.log.error({ err, gameId: game.id }, "Sprite generation failed");
    res.status(500).json({ error: "Sprite generation failed. Please try again." });
  }
});

export default router;
