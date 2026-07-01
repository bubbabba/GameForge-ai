export const GENRE_COLORS: Record<string, string> = {
  // 2D genres
  Platformer: "bg-blue-500/20 text-blue-400 border-blue-500/50",
  Shooter: "bg-red-500/20 text-red-400 border-red-500/50",
  Racing: "bg-yellow-500/20 text-yellow-400 border-yellow-500/50",
  RPG: "bg-purple-500/20 text-purple-400 border-purple-500/50",
  Puzzle: "bg-cyan-500/20 text-cyan-400 border-cyan-500/50",
  Adventure: "bg-emerald-500/20 text-emerald-400 border-emerald-500/50",
  Horror: "bg-zinc-700/30 text-zinc-300 border-zinc-600/50",
  Fantasy: "bg-pink-500/20 text-pink-400 border-pink-500/50",
  // 3D genres
  "FP Horror": "bg-zinc-700/30 text-zinc-300 border-zinc-600/50",
  "Space Shooter": "bg-indigo-500/20 text-indigo-400 border-indigo-500/50",
};

export const GAME_GENRES_2D = [
  "Platformer",
  "Shooter",
  "Racing",
  "RPG",
  "Puzzle",
  "Adventure",
  "Horror",
  "Fantasy",
] as const;

export const GAME_GENRES_3D = [
  "FP Horror",
  "Platformer",
  "Space Shooter",
  "Racing",
  "Puzzle",
] as const;

/** Legacy alias — kept so any existing imports still compile */
export const GAME_GENRES = GAME_GENRES_2D as unknown as string[];