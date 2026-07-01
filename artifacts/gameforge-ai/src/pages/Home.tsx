import { useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@clerk/react";
import {
  useGenerateGame,
  useSaveGame,
  useListPublicGames,
  getListPublicGamesQueryKey,
} from "@workspace/api-client-react";
import { GAME_GENRES_2D, GAME_GENRES_3D, GENRE_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import {
  Sparkles,
  Code,
  LayoutGrid,
  Loader2,
  ArrowRight,
  Box,
  Square,
  LogIn,
} from "lucide-react";
import GameCard from "@/components/GameCard";
import { useQueryClient } from "@tanstack/react-query";

type Engine = "2d" | "3d";

const ENGINE_TABS: {
  id: Engine;
  label: string;
  icon: typeof Square;
  description: string;
}[] = [
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
    description:
      "Three.js — first-person horror, third-person platformers, space shooters and more",
  },
];

const GENRE_DESCRIPTIONS_3D: Record<string, string> = {
  "FP Horror": "Walk through a dark maze — flashlight on, something is hunting you",
  Platformer: "Third-person — jump between platforms, collect coins, reach the goal",
  "Space Shooter": "Fly through space, dodge enemies, and blast them out of the stars",
  Racing: "Drive a car around a track — beat your lap time",
  Puzzle: "Push blocks onto targets in a 3D world",
};

export default function Home() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { isSignedIn } = useAuth();
  // Keep a ref so callbacks always see the latest sign-in state
  const isSignedInRef = useRef(isSignedIn);
  isSignedInRef.current = isSignedIn;

  const [engine, setEngine] = useState<Engine>("2d");
  const [prompt, setPrompt] = useState("");
  const [selected2DGenre, setSelected2DGenre] = useState<string>(GAME_GENRES_2D[0]);
  const [selected3DGenre, setSelected3DGenre] = useState<string>(GAME_GENRES_3D[0]);
  // Holds generated data when user is NOT signed in (so we can show preview)
  const [guestPreview, setGuestPreview] = useState<{
    gameCode: string;
    title: string;
    genre: string;
    engine: Engine;
    prompt: string;
  } | null>(null);

  const selectedGenre = engine === "2d" ? selected2DGenre : selected3DGenre;

  const generateGame = useGenerateGame();
  const saveGame = useSaveGame();

  const { data: recentGames, isLoading: loadingGames } = useListPublicGames(
    { limit: 6 },
    { query: { queryKey: getListPublicGamesQueryKey({ limit: 6 }) } },
  );

  // Combined busy state: generating OR saving
  const isBusy = generateGame.isPending || saveGame.isPending;

  const handleGenerate = () => {
    if (!prompt.trim()) {
      toast({
        title: "Prompt required",
        description: "Please describe your game.",
        variant: "destructive",
      });
      return;
    }

    // Clear any previous guest preview
    setGuestPreview(null);

    generateGame.mutate(
      { data: { prompt, genre: selectedGenre as any, engine } },
      {
        onSuccess: (data) => {
          if (isSignedInRef.current) {
            // Signed in: auto-save draft and navigate immediately to the editor
            saveGame.mutate(
              {
                data: {
                  title: data.title,
                  genre: selectedGenre,
                  prompt,
                  gameCode: data.gameCode,
                },
              },
              {
                onSuccess: (saved) => {
                  queryClient.invalidateQueries({ queryKey: ["/api/games/my"] });
                  setLocation(`/game/${saved.id}`);
                },
                onError: (err: any) => {
                  toast({
                    title: "Save failed",
                    description: err?.error || "Could not auto-save your game.",
                    variant: "destructive",
                  });
                },
              },
            );
          } else {
            // Not signed in: show preview with sign-in CTA
            setGuestPreview({
              gameCode: data.gameCode,
              title: data.title,
              genre: selectedGenre,
              engine,
              prompt,
            });
          }
        },
        onError: (err: any) => {
          toast({
            title: "Generation failed",
            description:
              err?.error || "Failed to generate game. Please try again.",
            variant: "destructive",
          });
        },
      },
    );
  };

  const handleEngineSwitch = (next: Engine) => {
    if (next === engine) return;
    generateGame.reset();
    setGuestPreview(null);
    setEngine(next);
  };

  // When a guest signs in after seeing the preview, save + navigate
  const handleGuestSave = () => {
    if (!guestPreview) return;
    saveGame.mutate(
      {
        data: {
          title: guestPreview.title,
          genre: guestPreview.genre,
          prompt: guestPreview.prompt,
          gameCode: guestPreview.gameCode,
        },
      },
      {
        onSuccess: (saved) => {
          queryClient.invalidateQueries({ queryKey: ["/api/games/my"] });
          setLocation(`/game/${saved.id}`);
        },
        onError: (err: any) => {
          toast({
            title: "Save failed",
            description: err?.error || "Could not save your game.",
            variant: "destructive",
          });
        },
      },
    );
  };

  const genreList = engine === "2d" ? GAME_GENRES_2D : GAME_GENRES_3D;
  const setSelectedGenre =
    engine === "2d" ? setSelected2DGenre : setSelected3DGenre;

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
              Describe your idea — our AI builds a fully playable browser game in
              seconds.
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
                    disabled={isBusy}
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
              Three.js engine — uses a hardened template; genre shapes the
              gameplay, not the boilerplate
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
              disabled={isBusy}
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
                      disabled={isBusy}
                      data-testid={`genre-tag-${genre}`}
                      title={
                        engine === "3d"
                          ? GENRE_DESCRIPTIONS_3D[genre]
                          : undefined
                      }
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
                disabled={isBusy || !prompt.trim()}
                data-testid="create-game-button"
                className="w-full sm:w-auto shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-8 shadow-[0_0_20px_rgba(34,197,94,0.3)] hover:shadow-[0_0_30px_rgba(34,197,94,0.4)] transition-all"
              >
                {generateGame.isPending ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    {engine === "3d" ? "Forging 3D…" : "Forging…"}
                  </>
                ) : saveGame.isPending ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Saving draft…
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
              {(generateGame.error as any)?.error ||
                "Something went wrong — please try again with a different prompt."}
            </div>
          )}
        </div>
      </div>

      {/* ── Guest preview (not signed in) ──────────────────────────────────── */}
      {guestPreview && (
        <div className="px-6 lg:px-12 py-10 border-b border-border bg-black/40">
          <div className="max-w-6xl mx-auto space-y-5">
            {/* Title + badges */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-3xl font-display font-bold">
                  {guestPreview.title}
                </h2>
                <div className="flex items-center gap-2 mt-2">
                  <span
                    className={cn(
                      "inline-block px-3 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider border",
                      GENRE_COLORS[guestPreview.genre] ??
                        "bg-primary/20 text-primary border-primary/30",
                    )}
                  >
                    {guestPreview.genre}
                  </span>
                  <span
                    className={cn(
                      "inline-block px-2.5 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider border",
                      guestPreview.engine === "3d"
                        ? "bg-violet-500/20 text-violet-400 border-violet-500/30"
                        : "bg-sky-500/20 text-sky-400 border-sky-500/30",
                    )}
                  >
                    {guestPreview.engine === "3d"
                      ? "Three.js 3D"
                      : "Phaser.js 2D"}
                  </span>
                </div>
              </div>

              {/* Sign-in CTA */}
              <div className="flex items-center gap-3">
                {isSignedIn ? (
                  // User just signed in — offer to save
                  <Button
                    onClick={handleGuestSave}
                    disabled={saveGame.isPending}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                    data-testid="save-draft-button"
                  >
                    {saveGame.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Code className="w-4 h-4 mr-2" />
                    )}
                    Save & Open Editor
                  </Button>
                ) : (
                  <Link href="/sign-in">
                    <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_15px_rgba(34,197,94,0.3)]">
                      <LogIn className="w-4 h-4 mr-2" />
                      Sign in to save &amp; edit
                    </Button>
                  </Link>
                )}
              </div>
            </div>

            {/* Sign-in callout banner */}
            {!isSignedIn && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-primary/5 border border-primary/20 text-sm text-primary/80">
                <LogIn className="w-4 h-4 shrink-0" />
                <span>
                  <strong>Sign in to save this game.</strong> You can play it
                  right now — sign in first to keep it and open the code editor.
                </span>
              </div>
            )}

            {/* Game iframe */}
            <div className="w-full aspect-[16/10] rounded-xl overflow-hidden border border-border bg-card shadow-2xl relative">
              <iframe
                srcDoc={guestPreview.gameCode}
                className="w-full h-full border-none bg-black"
                sandbox="allow-scripts allow-same-origin"
                title="Generated Game"
                data-testid="game-iframe"
              />
              <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-xl pointer-events-none" />
            </div>

            {guestPreview.engine === "3d" && (
              <p className="text-xs text-muted-foreground text-center">
                3D games use Three.js. Click inside the frame first, then use
                keyboard controls shown on screen.
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
              <div
                key={i}
                className="h-[280px] bg-card/50 border border-border rounded-xl animate-pulse"
              />
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
