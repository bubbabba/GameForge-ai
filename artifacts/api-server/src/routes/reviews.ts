import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { eq, and, desc, sql } from "drizzle-orm";
import { db, gamesTable, reviewsTable, reviewHelpfulTable } from "@workspace/db";
import { CreateReviewBody, CreateReplyBody } from "@workspace/api-zod";

const router: IRouter = Router();

const requireAuth = (req: any, res: any, next: any) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Authentication required" }); return; }
  req.userId = userId;
  next();
};

// ── List reviews for a game ───────────────────────────────────────────────────

router.get("/games/:id/reviews", async (req: any, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid game id" }); return; }

  const { userId } = getAuth(req);

  const reviews = await db
    .select()
    .from(reviewsTable)
    .where(and(eq(reviewsTable.gameId, id), eq(reviewsTable.isFlagged, 0)))
    .orderBy(desc(reviewsTable.helpfulCount), desc(reviewsTable.createdAt));

  // Attach isHelpful for authenticated user
  if (userId && reviews.length > 0) {
    const helpfulRows = await db
      .select({ reviewId: reviewHelpfulTable.reviewId })
      .from(reviewHelpfulTable)
      .where(eq(reviewHelpfulTable.userId, userId));
    const helpfulSet = new Set(helpfulRows.map((r) => r.reviewId));
    res.json(reviews.map((r) => ({ ...r, isHelpful: helpfulSet.has(r.id) })));
    return;
  }

  res.json(reviews.map((r) => ({ ...r, isHelpful: false })));
});

// ── Create a review ───────────────────────────────────────────────────────────

router.post("/games/:id/reviews", requireAuth, async (req: any, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid game id" }); return; }

  const parsed = CreateReviewBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues.map((i: any) => `${i.path.join(".")}: ${i.message}`).join(", ") });
    return;
  }

  const { rating, body } = parsed.data;

  // Resolve author name from Clerk claims
  const auth = getAuth(req);
  const authorName = (auth as any).sessionClaims?.name
    || (auth as any).sessionClaims?.fullName
    || (auth as any).sessionClaims?.username
    || "Player";

  // All writes are wrapped in a transaction to keep review row + game aggregate consistent
  const review = await db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: reviewsTable.id })
      .from(reviewsTable)
      .where(and(eq(reviewsTable.gameId, id), eq(reviewsTable.authorId, req.userId)));

    let row;
    if (existing.length > 0) {
      [row] = await tx
        .update(reviewsTable)
        .set({ rating, body: body ?? null })
        .where(eq(reviewsTable.id, existing[0].id))
        .returning();
    } else {
      [row] = await tx
        .insert(reviewsTable)
        .values({ gameId: id, authorId: req.userId, authorName, rating, body: body ?? null })
        .returning();
    }

    // Recompute aggregate inside the transaction (consistent read)
    const [stats] = await tx
      .select({
        count: sql<number>`COUNT(*)::int`,
        avg: sql<number>`AVG(rating)::real`,
      })
      .from(reviewsTable)
      .where(and(eq(reviewsTable.gameId, id), eq(reviewsTable.isFlagged, 0)));

    await tx
      .update(gamesTable)
      .set({ ratingCount: stats.count, averageRating: stats.avg })
      .where(eq(gamesTable.id, id));

    return row;
  });

  res.json({ ...review, isHelpful: false });
});

// ── Mark review as helpful (toggle) ──────────────────────────────────────────

router.post("/games/:id/reviews/:reviewId/helpful", requireAuth, async (req: any, res): Promise<void> => {
  const reviewId = parseInt(req.params.reviewId, 10);
  if (isNaN(reviewId)) { res.status(400).json({ error: "Invalid review id" }); return; }

  const { helpful, helpfulCount } = await db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: reviewHelpfulTable.id })
      .from(reviewHelpfulTable)
      .where(and(eq(reviewHelpfulTable.reviewId, reviewId), eq(reviewHelpfulTable.userId, req.userId)));

    let isHelpful: boolean;
    if (existing.length > 0) {
      await tx.delete(reviewHelpfulTable).where(eq(reviewHelpfulTable.id, existing[0].id));
      isHelpful = false;
    } else {
      await tx.insert(reviewHelpfulTable).values({ reviewId, userId: req.userId });
      isHelpful = true;
    }

    const [countRow] = await tx
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(reviewHelpfulTable)
      .where(eq(reviewHelpfulTable.reviewId, reviewId));

    await tx
      .update(reviewsTable)
      .set({ helpfulCount: countRow.count })
      .where(eq(reviewsTable.id, reviewId));

    return { helpful: isHelpful, helpfulCount: countRow.count };
  });

  res.json({ helpful, helpfulCount });
});

// ── Creator reply to a review ─────────────────────────────────────────────────

router.post("/games/:id/reviews/:reviewId/reply", requireAuth, async (req: any, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const reviewId = parseInt(req.params.reviewId, 10);
  if (isNaN(id) || isNaN(reviewId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = CreateReplyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues.map((i: any) => `${i.path.join(".")}: ${i.message}`).join(", ") });
    return;
  }

  // Only the game's author can reply — verify game ownership first
  const [game] = await db.select({ authorId: gamesTable.authorId }).from(gamesTable).where(eq(gamesTable.id, id));
  if (!game || game.authorId !== req.userId) {
    res.status(403).json({ error: "Only the game creator can reply to reviews" });
    return;
  }

  // Scope update to BOTH reviewId AND gameId — prevents cross-game IDOR writes
  const [review] = await db
    .update(reviewsTable)
    .set({ replyText: parsed.data.replyText, repliedAt: new Date() })
    .where(and(eq(reviewsTable.id, reviewId), eq(reviewsTable.gameId, id)))
    .returning();

  if (!review) { res.status(404).json({ error: "Review not found on this game" }); return; }
  res.json({ ...review, isHelpful: false });
});

// ── Flag a review ─────────────────────────────────────────────────────────────

router.post("/games/:id/reviews/:reviewId/flag", requireAuth, async (req: any, res): Promise<void> => {
  const reviewId = parseInt(req.params.reviewId, 10);
  if (isNaN(reviewId)) { res.status(400).json({ error: "Invalid review id" }); return; }

  await db.update(reviewsTable).set({ isFlagged: 1 }).where(eq(reviewsTable.id, reviewId));
  res.json({ flagged: true });
});

export default router;
