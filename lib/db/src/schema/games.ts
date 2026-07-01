import { pgTable, text, serial, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const gamesTable = pgTable("games", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  genre: text("genre").notNull(),
  prompt: text("prompt").notNull(),
  gameCode: text("game_code").notNull(),
  status: text("status").notNull().default("draft"), // "draft" | "published"
  slug: text("slug").notNull().unique(),
  likesCount: integer("likes_count").notNull().default(0),
  authorId: text("author_id").notNull(),   // Clerk user ID
  authorName: text("author_name").notNull(),
  /** Latest live version of the code — updated after every successful AI chat edit */
  currentCode: text("current_code"),
  /** Increments each time an AI chat edit is successfully applied */
  codeVersion: integer("code_version").notNull().default(0),
  /** Object-storage path for the AI-generated cover image (e.g. /objects/images/{uuid}) */
  coverImageUrl: text("cover_image_url"),
  /** JSON array of auto-generated sprites: { name, url, objectPath, description }[] */
  spritesJson: text("sprites_json"),
  /** Game design document written by Claude in Step 1 of generation */
  gamePlan: text("game_plan"),
  /** Serialized GameContext JSON — setting, player, enemies, art style, palette, mood */
  gameContext: text("game_context"),
  /** 'complete' | 'sprites_pending' — set to sprites_pending when game saves without sprites */
  generationStatus: text("generation_status").notNull().default("complete"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const likesTable = pgTable("likes", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),   // Clerk user ID
  gameId: integer("game_id").notNull().references(() => gamesTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("likes_user_game_idx").on(table.userId, table.gameId),
]);

export const insertGameSchema = createInsertSchema(gamesTable).omit({
  id: true,
  likesCount: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLikeSchema = createInsertSchema(likesTable).omit({
  id: true,
  createdAt: true,
});

export type InsertGame = z.infer<typeof insertGameSchema>;
export type Game = typeof gamesTable.$inferSelect;
export type Like = typeof likesTable.$inferSelect;
