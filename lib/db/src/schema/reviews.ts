import { pgTable, text, serial, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { gamesTable } from "./games";

export const reviewsTable = pgTable("reviews", {
  id: serial("id").primaryKey(),
  gameId: integer("game_id").notNull().references(() => gamesTable.id, { onDelete: "cascade" }),
  authorId: text("author_id").notNull(),
  authorName: text("author_name").notNull(),
  rating: integer("rating").notNull(), // 1–10
  body: text("body"),
  replyText: text("reply_text"),
  repliedAt: timestamp("replied_at", { withTimezone: true }),
  helpfulCount: integer("helpful_count").notNull().default(0),
  isFlagged: integer("is_flagged").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("reviews_author_game_idx").on(table.authorId, table.gameId),
]);

export const reviewHelpfulTable = pgTable("review_helpful", {
  id: serial("id").primaryKey(),
  reviewId: integer("review_id").notNull().references(() => reviewsTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("helpful_user_review_idx").on(table.userId, table.reviewId),
]);

export type Review = typeof reviewsTable.$inferSelect;
export type ReviewHelpful = typeof reviewHelpfulTable.$inferSelect;
