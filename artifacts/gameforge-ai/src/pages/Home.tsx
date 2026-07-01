import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useGenerateGame, useSaveGame, useListPublicGames, getListPublicGamesQueryKey } from "@workspace/api-client-react";
import { GAME_GENRES_2D, GAME_GENRES_3D, GENRE_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Sparkles, Save, Code, LayoutGrid, Loader2, ArrowRight, Box, Square } from "lucide-react";
import GameCard from "@/components/GameCard";
import { useQueryClient } from "@tanstack/react-query";

type Engine = "2d" | "3d";

const ENGINE_TABS: { id: Engine; label: string; icon: typeof Square; description: string }[] = [
  {
    id: "2d",
    label: "2D",
    icon: Square,
    description: "Phaser.js — classic 2D platformers, shooters, puzzles and more",
  },
  {
    id: "3d",
    label: "3D",
    icon: Box,
    description: "Three.js — first-person horror, third-person platformers, space shooters and more",
  },
];

const GENRE_DESCRIPTIONS_3D: Record<string, string> = {
  "FP Horror":     "Walk through a dark maze — flashlight on, something is hunting you",
  "Platformer":    "Third-person — jump between platforms, collect coins, reach the goal",
  "Space Shooter": "Fly through space, dodge enemies, and blast them out of the stars",
  "Racing":        "Drive a car around a track — beat your lap time",
  "Puzzle":        "Push blocks onto targets in a 3D world",
};

export default function Home() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [engine, setEngine] = useState<Engine>("2d");
  const [prompt, setPrompt] = useState("");
  const [selected2DGenre, setSelected2DGenre] = useState<string>(GAME_GENRES_2D[0]);
  const [selected3DGenre, setSelected3DGenre] = useState<string>(GAME_GENRES_3D[0]);

  const selectedGenre = engine === "2d" ? selected2DGenre : selected3DGenre;

  const generateGame = useGenerateGame();
  const saveGame = useSaveGame();

  const { data: recentGames, isLoading: loadingGames } = useListPublicGames(
    { limit: 6 },
    { query: { queryKey: getListPublicGamesQueryKey({ limit: 6 }) } },
  );

  const handleGenerate = () => {
    if (!prompt.trim()) {
      toast({ title: "Prompt required", description: "Please describe your game.", variant: "destructive" });
      return;
    }
    generateGame.mutate(
      { data: { prompt, genre: selectedGenre as any, engine } },
      {
        onError: (err: any) => {
          toast({
            title: "Generation failed",
            description: err?.error || "Failed to generate game. Please try again.",
            variant: "destructive",
          });
        },
      },
    );
  };

  const handleSaveDraft = () => {
    if (!generateGame.data) return;
    saveGame.mutate(
      {
        data: {
          title: generateGame.data.title,
          genre: selectedGenre,
          prompt,
          gameCode: generateGame.data.gameCode,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Game saved!", description: "Your game has been saved as a draft." });
          queryClient.invalidateQueries({ queryKey: ["/api/games/my"] });
        },
        onError: (err: any) => {
          toast({ title: "Save failed", description: err?.error || "Could not save draft.", variant: "destructive" });
        },
      },
    );
  };

  const handleDiscard = () => {
    generateGame.reset();
    setPrompt("");
  };

  const handleEngineSwitch = (next: Engine) => {
    if (next === engine) return;
    generateGame.reset();
    setEngine(next);
  };

  const genreList = engine === "2d" ? GAME_GENRES_2D : GAME_GENRES_3D;
  const setSelectedGenre = engine === "2d" ? setSelected2DGenre : setSelected3DGenre;

  return (
    <div className="flex-1 flex flex-col">
      {/* ── Hero Section ──────────────────────────────────────────────────── */}
      <div className="relative pt-20 pb-14 px-6 lg:px-12 flex flex-col items-center border-b border-border overflow-hidden">
        {/* background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative z-10 w-full max-w-4xl mx-auto text-center space-y-6">
          <div className="space-y-3">
            <h1 className="text-5xl md:text-7xl font-display font-bold tracking-tight">
              What game will you{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-emerald-300">
                forge
              </span>{" "}
              today?
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Describe your idea — our AI builds a fully playable browser game in seconds.
            </p>
          </div>

          {/* ── Engine toggle ──────────────────────────────────────────────── */}
          <div className="flex justify-center">
            <div
              className="inline-flex rounded-xl border border-border bg-card p-1 gap-1"
              role="group"
              aria-label="Game engine"
              data-testid="engine-toggle"
            >
              {ENGINE_TABS.map((tab) => {
                const Icon = tab.icon;
                const active = engine === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleEngineSwitch(tab.id)}
                    disabled={generateGame.isPending}
                    data-testid={`engine-tab-${tab.id}`}
                    title={tab.description}
                    className={cn(
                      "flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-200",
                      active
                        ? "bg-primary text-primary-foreground shadow-[0_0_14px_rgba(34,197,94,0.35)]"
                        : "text-muted-foreground hover:text-foreground hover:bg-white/5",
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3D mode sub-label */}
          {engine === "3d" && (
            <p className="text-xs text-primary/70 font-mono tracking-wide -mt-2">
              Three.js engine — uses a hardened template; genre shapes the gameplay, not the boilerplate
            </p>
          )}

          {/* ── Creator card ───────────────────────────────────────────────── */}
          <div className="bg-card border border-border p-4 rounded-2xl shadow-2xl shadow-black/50">
            <textarea
              data-testid="prompt-input"
              className="w-full h-28 bg-transparent text-foreground placeholder:text-muted-foreground/50 resize-none border-none focus:ring-0 p-2 text-lg"
              placeholder={
                engine === "2d"
                  ? "A side-scrolling platformer where a robot escapes a collapsing neon factory..."
                  : engine === "3d" && selected3DGenre === "FP Horror"
                  ? "A horror maze where the walls shift and a shadowy monster hunts you by sound..."
                  : engine === "3d" && selected3DGenre === "Space Shooter"
                  ? "A space battle where you pilot a fighter through an asteroid field..."
                  : "Describe your game idea..."
              }
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={generateGame.isPending || saveGame.isSuccess}
            />

            {/* Genre tags */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-4 border-t border-border mt-2">
              <div className="flex flex-wrap gap-2">
                {genreList.map((genre) => {
                  const active = selectedGenre === genre;
                  return (
                    <button
                      key={genre}
                      onClick={() => setSelectedGenre(genre)}
                      disabled={generateGame.isPending || saveGame.isSuccess}
                      data-testid={`genre-tag-${genre}`}
                      title={engine === "3d" ? GENRE_DESCRIPTIONS_3D[genre] : undefined}
                      className={cn(
                        "px-4 py-1.5 rounded-full text-sm font-medium transition-all border",
                        active
                          ? "bg-primary/20 text-primary border-primary shadow-[0_0_10px_rgba(34,197,94,0.2)]"
                          : "bg-white/5 text-muted-foreground border-transparent hover:bg-white/10 hover:text-foreground",
                      )}
                    >
                      {genre}
                    </button>
                  );
                })}
              </div>

              <Button
                size="lg"
                onClick={handleGenerate}
                disabled={generateGame.isPending || saveGame.isSuccess || !prompt.trim()}
                data-testid="create-game-button"
                className="w-full sm:w-auto shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-8 shadow-[0_0_20px_rgba(34,197,94,0.3)] hover:shadow-[0_0_30px_rgba(34,197,94,0.4)] transition-all"
              >
                {generateGame.isPending ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    {engine === "3d" ? "Forging 3D..." : "Forging..."}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 mr-2" />
                    Create {engine === "3d" ? "3D " : ""}Game
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* ── Error state ────────────────────────────────────────────────── */}
          {generateGame.isError && (
            <div
              data-testid="generate-error"
              className="p-4 bg-destructive/10 border border-destructive/30 text-destructive rounded-lg text-sm text-left"
            >
              <span className="font-semibold">Generation failed.</span>{" "}
              {(generateGame.error as any)?.error || "Something went wrong — please try again with a different prompt."}
            </div>
          )}
        </div>
      </div>

      {/* ── Generated Game Display ─────────────────────────────────────────── */}
      {generateGame.data && (
        <div className="px-6 lg:px-12 py-10 border-b border-border bg-black/40">
          <div className="max-w-6xl mx-auto space-y-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-3xl font-display font-bold">{generateGame.data.title}</h2>
                <div className="flex items-center gap-2 mt-2">
                  <span
                    className={cn(
                      "inline-block px-3 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider border",
                      GENRE_COLORS[selectedGenre] ?? "bg-primary/20 text-primary border-primary/30",
                    )}
                  >
                    {selectedGenre}
                  </span>
                  <span
                    className={cn(
                      "inline-block px-2.5 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider border",
                      engine === "3d"
                        ? "bg-violet-500/20 text-violet-400 border-violet-500/30"
                        : "bg-sky-500/20 text-sky-400 border-sky-500/30",
                    )}
                  >
                    {engine === "3d" ? "Three.js 3D" : "Phaser.js 2D"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {saveGame.isSuccess ? (
                  <Link href={`/game/${saveGame.data.id}`}>
                    <Button
                      variant="outline"
                      className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                    >
                      <Code className="w-4 h-4 mr-2" /> Open in Editor
                    </Button>
                  </Link>
                ) : (
                  <>
                    <Button variant="ghost" onClick={handleDiscard} disabled={saveGame.isPending}>
                      Discard
                    </Button>
                    <Button
                      onClick={handleSaveDraft}
                      disabled={saveGame.isPending}
                      data-testid="save-draft-button"
                      className="bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                      {saveGame.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4 mr-2" />
                      )}
                      Save as Draft
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Game iframe */}
            <div className="w-full aspect-[16/10] rounded-xl overflow-hidden border border-border bg-card shadow-2xl relative group">
              <iframe
                srcDoc={generateGame.data.gameCode}
                className="w-full h-full border-none bg-black"
                sandbox="allow-scripts allow-same-origin"
                title="Generated Game"
                data-testid="game-iframe"
              />
              <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-xl pointer-events-none" />
            </div>

            {engine === "3d" && (
              <p className="text-xs text-muted-foreground text-center">
                3D games use Three.js. Click inside the frame first, then use keyboard controls shown on screen.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Community Preview ──────────────────────────────────────────────── */}
      <div className="px-6 lg:px-12 py-16 max-w-7xl mx-auto w-full">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-display font-bold flex items-center gap-2">
            <LayoutGrid className="w-6 h-6 text-primary" />
            Recently Forged
          </h2>
          <Link href="/explore">
            <Button variant="ghost" className="text-muted-foreground hover:text-foreground">
              View all <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>

        {loadingGames ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-[280px] bg-card/50 border border-border rounded-xl animate-pulse" />
            ))}
          </div>
        ) : recentGames && recentGames.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recentGames.map((game) => (
              <GameCard key={game.id} game={game} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground bg-card/50 rounded-xl border border-dashed border-border">
            No games published yet. Be the first to forge one.
          </div>
        )}
      </div>
    </div>
  );
}
