import { useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@clerk/react";
import {
  useSaveGame,
  useListPublicGames,
  getListPublicGamesQueryKey,
} from "@workspace/api-client-react";
import { streamPost } from "@/lib/streamPost";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import {
  Sparkles,
  Code,
  LayoutGrid,
  Loader2,
  ArrowRight,
  LogIn,
} from "lucide-react";
import GameCard from "@/components/GameCard";
import { useQueryClient } from "@tanstack/react-query";
import { GENRE_COLORS } from "@/lib/constants";

export default function Home() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { isSignedIn } = useAuth();
  const isSignedInRef = useRef(isSignedIn);
  isSignedInRef.current = isSignedIn;

  const [prompt, setPrompt] = useState("");

  // Holds generated data when user is NOT signed in (so we can show preview)
  const [guestPreview, setGuestPreview] = useState<{
    gameCode: string;
    title: string;
    genre: string;
    engine: "2d" | "3d";
    prompt: string;
    qualityScore?: number;
    gamePlan?: string;
  } | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const saveGame = useSaveGame();

  const { data: recentGames, isLoading: loadingGames } = useListPublicGames(
    { limit: 6 },
    { query: { queryKey: getListPublicGamesQueryKey({ limit: 6 }) } },
  );

  const isBusy = isGenerating || saveGame.isPending;

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast({
        title: "Prompt required",
        description: "Please describe your game.",
        variant: "destructive",
      });
      return;
    }

    setGuestPreview(null);
    setGenerateError(null);
    setStatusMessage(null);
    setIsGenerating(true);

    try {
      const data = await streamPost<{
        gameCode: string;
        title: string;
        engine: "2d" | "3d";
        genre: string;
        qualityScore?: number;
        gamePlan?: string;
        sprites?: Array<{ name: string; objectPath: string; url: string; description: string }>;
        backgroundSprite?: { name: string; objectPath: string; url: string; description: string } | null;
      }>("/api/games/generate", { prompt }, (msg) => setStatusMessage(msg));

      const resolvedGenre = data.genre ?? "Platformer";
      const resolvedEngine = data.engine ?? "2d";

      // Serialize sprites for DB storage (objectPaths, not absolute URLs)
      const spritesList = [
        ...(data.sprites ?? []).map((s) => ({ name: s.name, url: s.objectPath, description: s.description })),
        ...(data.backgroundSprite ? [{ name: "bg", url: data.backgroundSprite.objectPath, description: data.backgroundSprite.description }] : []),
      ];
      const spritesJson = spritesList.length > 0 ? JSON.stringify(spritesList) : undefined;

      if (isSignedInRef.current) {
        saveGame.mutate(
          {
            data: {
              title: data.title,
              genre: resolvedGenre,
              prompt,
              gameCode: data.gameCode,
              spritesJson,
            },
          },
          {
            onSuccess: (saved) => {
              queryClient.invalidateQueries({ queryKey: ["/api/games/my"] });
              if (data.gamePlan) {
                sessionStorage.setItem(`gamePlan_${saved.id}`, data.gamePlan);
              }
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
        setGuestPreview({
          gameCode: data.gameCode,
          title: data.title,
          genre: resolvedGenre,
          engine: resolvedEngine,
          prompt,
          qualityScore: data.qualityScore,
          gamePlan: data.gamePlan,
        });
      }
    } catch (err: any) {
      setGenerateError(err?.error || "Failed to generate game. Please try again.");
    } finally {
      setIsGenerating(false);
      setStatusMessage(null);
    }
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
          if (guestPreview.gamePlan) {
            sessionStorage.setItem(`gamePlan_${saved.id}`, guestPreview.gamePlan);
          }
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
              Describe any game you can imagine — our AI figures out the rest and
              builds it in seconds.
            </p>
          </div>

          {/* ── Creator card ───────────────────────────────────────────────── */}
          <div className="bg-card border border-border p-4 rounded-2xl shadow-2xl shadow-black/50">
            <textarea
              data-testid="prompt-input"
              className="w-full h-40 bg-transparent text-foreground placeholder:text-muted-foreground/50 resize-none border-none focus:ring-0 p-2 text-lg"
              placeholder="Describe any game you can imagine..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={isBusy}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleGenerate();
              }}
            />

            <div className="flex items-center justify-between gap-4 pt-4 border-t border-border mt-2">
              <p className="text-xs text-muted-foreground/60 hidden sm:block">
                AI automatically picks 2D or 3D and the genre based on your description
              </p>
              <Button
                size="lg"
                onClick={handleGenerate}
                disabled={isBusy || !prompt.trim()}
                data-testid="create-game-button"
                className="w-full sm:w-auto shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-8 shadow-[0_0_20px_rgba(34,197,94,0.3)] hover:shadow-[0_0_30px_rgba(34,197,94,0.4)] transition-all"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    {statusMessage ?? "Forging…"}
                  </>
                ) : saveGame.isPending ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Saving draft…
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 mr-2" />
                    Create Game
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* ── Error state ────────────────────────────────────────────────── */}
          {generateError && (
            <div
              data-testid="generate-error"
              className="p-4 bg-destructive/10 border border-destructive/30 text-destructive rounded-lg text-sm text-left"
            >
              <span className="font-semibold">Generation failed.</span>{" "}
              {generateError}
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
                    {guestPreview.engine === "3d" ? "Three.js 3D" : "Phaser.js 2D"}
                  </span>
                  {guestPreview.qualityScore != null && (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold border",
                        guestPreview.qualityScore >= 80
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                          : guestPreview.qualityScore >= 60
                          ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                          : "bg-orange-500/20 text-orange-400 border-orange-500/30",
                      )}
                      title="AI-assessed quality score"
                    >
                      ★ {guestPreview.qualityScore}/100
                    </span>
                  )}
                </div>
              </div>

              {/* Sign-in CTA */}
              <div className="flex items-center gap-3">
                {isSignedIn ? (
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
                    Save &amp; Open Editor
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
                sandbox="allow-scripts"
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
