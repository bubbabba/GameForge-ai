---
name: Community features — play count, ratings, reviews, export
description: How play tracking, 1-10 ratings, reviews, and game export work; key security decisions.
---

## DB changes
- `gamesTable` gains: `play_count int default 0`, `rating_count int default 0`, `average_rating real` (null = no ratings)
- `reviewsTable`: one review per user per game (unique index on author_id, game_id); `is_flagged` is 0/1 integer; `reply_text`/`replied_at` for creator responses
- `reviewHelpfulTable`: unique index on (user_id, review_id) prevents double-helpful

## API routes
- `POST /api/games/:id/play` — in games.ts; server-side dedup via in-memory `Map<ip:gameId, timestamp>` with 5-minute TTL (see `throttlePlay()`); no auth required
- Reviews CRUD in `artifacts/api-server/src/routes/reviews.ts`; mounted via routes/index.ts

## Security decisions
- Reply route IDOR fix: UPDATE uses `WHERE id = reviewId AND game_id = id` — prevents a creator of game A from replying to reviews on game B using their own game's id
- Rating/helpful mutations wrapped in `db.transaction()` to keep denormalized averageRating/helpfulCount consistent under concurrency

## Frontend
- `ExportPanel.tsx`: left-sidebar nav with 4 options (HTML blob, embed iframe, ZIP via jszip, itch.io ZIP)
- `RatingPrompt.tsx`: modal overlay triggered 30s after game load; 1-10 star UI; localStorage `rated-{id}` prevents re-prompt
- `ReviewsSection.tsx`: shows below PlayGame iframe; helpful/flag/reply mutations update query cache on success
- `PlayGame.tsx`: layout changed from full-screen to scrollable (70svh iframe + reviews below)
- `GameCard.tsx`: optional playCount + averageRating badges; existing callers safe (fields are optional with null guards)
- `Explore.tsx`: sort tabs — Newest / Trending / Most Played / Top Rated — wired to `GET /games/public?sort=`

## Extra hooks
- New hooks NOT in orval-generated api.ts → `lib/api-client-react/src/generated/extra-api.ts`, exported from index.ts
- Pattern: add future hand-written hooks to extra-api.ts to avoid touching generated file

**Why:**
- Dedup in memory (not DB) keeps the play endpoint latency low without a separate table
- averageRating denormalized on gamesTable for O(1) sort-by-rating without aggregation at query time
