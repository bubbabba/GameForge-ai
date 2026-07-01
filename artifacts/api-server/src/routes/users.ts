import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { eq, count, sum } from "drizzle-orm";
import { db, gamesTable, likesTable } from "@workspace/db";

const router: IRouter = Router();

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

// ── Current User Profile ──────────────────────────────────────────────────

router.get("/users/me", requireAuth, async (req: any, res): Promise<void> => {
  const auth = getAuth(req);
  const claims = auth?.sessionClaims;
  const firstName = (claims?.["firstName"] as string) ?? "";
  const lastName = (claims?.["lastName"] as string) ?? "";
  const email = (claims?.["email"] as string) ?? "";
  const name = [firstName, lastName].filter(Boolean).join(" ") || email || "Anonymous";

  // Count games by status
  const [gameStats] = await db
    .select({
      total: count(),
      published: sum(
        // cast published to 1 else 0
        eq(gamesTable.status, "published") as any,
      ),
    })
    .from(gamesTable)
    .where(eq(gamesTable.authorId, req.userId));

  const allGames = await db
    .select({ status: gamesTable.status, likesCount: gamesTable.likesCount })
    .from(gamesTable)
    .where(eq(gamesTable.authorId, req.userId));

  const totalGames = allGames.length;
  const publishedGames = allGames.filter((g) => g.status === "published").length;
  const draftGames = allGames.filter((g) => g.status === "draft").length;
  const totalLikes = allGames.reduce((acc, g) => acc + (g.likesCount ?? 0), 0);

  res.json({
    id: req.userId,
    name,
    totalGames,
    publishedGames,
    draftGames,
    totalLikes,
  });
});

// ── Liked Games IDs ───────────────────────────────────────────────────────

router.get("/users/me/liked", requireAuth, async (req: any, res): Promise<void> => {
  const likes = await db
    .select({ gameId: likesTable.gameId })
    .from(likesTable)
    .where(eq(likesTable.userId, req.userId));

  res.json(likes.map((l) => l.gameId));
});

export default router;
