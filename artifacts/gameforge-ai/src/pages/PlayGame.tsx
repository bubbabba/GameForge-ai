import { useEffect, useRef, useState } from "react";
import { useRoute } from "wouter";
import { useGetGameBySlug, useToggleLike, useGetMyLikedGames, getGetMyLikedGamesQueryKey } from "@workspace/api-client-react";
import { useRecordPlay, useCreateReview } from "@workspace/api-client-react";
import { useAuth } from "@clerk/react";
import { Loader2, Heart, Share2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { GAME_GENRES, GENRE_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import RatingPrompt from "@/components/RatingPrompt";
import ReviewsSection from "@/components/ReviewsSection";
import { getGetReviewsQueryKey } from "@workspace/api-client-react";

export default function PlayGame() {
  const [, params] = useRoute("/play/:slug");
  const slug = params?.slug;
  const { isSignedIn, userId } = useAuth();
  const queryClient = useQueryClient();

  const { data: game, isLoading, error } = useGetGameBySlug(slug!, {
    query: { enabled: !!slug, queryKey: ["/api/games/slug", slug] }
  });

  const { data: likedGames } = useGetMyLikedGames({ query: { enabled: !!isSignedIn, queryKey: getGetMyLikedGamesQueryKey() } });
  const toggleLike = useToggleLike();
  const recordPlay = useRecordPlay();
  const createReview = useCreateReview();

  const isLiked = game && likedGames?.includes(game.id);
  const [showRatingPrompt, setShowRatingPrompt] = useState(false);

  // ── Play count (10 s gate, once per session) ──────────────────────────────
  const playTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ratingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!game?.id) return;

    const alreadyPlayed = sessionStorage.getItem(`played-${game.id}`);
    const alreadyRated = localStorage.getItem(`rated-${game.id}`);

    if (!alreadyPlayed) {
      playTimerRef.current = setTimeout(() => {
        sessionStorage.setItem(`played-${game.id}`, "1");
        recordPlay.mutate(
          { id: game.id },
          {
            onSuccess: (data) => {
              queryClient.setQueryData(["/api/games/slug", slug], (old: any) =>
                old ? { ...old, playCount: data.playCount } : old,
              );
            },
          },
        );
      }, 10_000);
    }

    if (!alreadyRated && isSignedIn) {
      ratingTimerRef.current = setTimeout(() => {
        setShowRatingPrompt(true);
      }, 30_000);
    }

    return () => {
      if (playTimerRef.current) clearTimeout(playTimerRef.current);
      if (ratingTimerRef.current) clearTimeout(ratingTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.id, isSignedIn]);

  // ── Like ──────────────────────────────────────────────────────────────────
  const handleLike = () => {
    if (!isSignedIn) {
      toast({ title: "Sign in required", description: "You must be signed in to like games.", variant: "destructive" });
      return;
    }
    if (!game) return;
    toggleLike.mutate({ id: game.id }, {
      onSuccess: (data) => {
        queryClient.setQueryData(["/api/games/slug", slug], (old: any) =>
          old ? { ...old, likesCount: data.likesCount } : old,
        );
        queryClient.invalidateQueries({ queryKey: ["/api/users/me/liked"] });
      }
    });
  };

  // ── Share ─────────────────────────────────────────────────────────────────
  const copyShareLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast({ title: "Link copied", description: "Game link copied to clipboard." });
  };

  // ── Rating submit ─────────────────────────────────────────────────────────
  const handleRatingSubmit = (rating: number, body: string) => {
    if (!game) return;
    createReview.mutate(
      { id: game.id, data: { rating, body: body || undefined } },
      {
        onSuccess: () => {
          localStorage.setItem(`rated-${game.id}`, "1");
          setShowRatingPrompt(false);
          queryClient.invalidateQueries({ queryKey: getGetReviewsQueryKey({ id: game.id }) });
          queryClient.setQueryData(["/api/games/slug", slug], (old: any) =>
            old
              ? {
                  ...old,
                  ratingCount: (old.ratingCount ?? 0) + 1,
                }
              : old,
          );
          toast({ title: "Thanks for your rating!", description: "Your review helps other players discover great games." });
        },
        onError: () => {
          toast({ title: "Could not submit", description: "Please try again.", variant: "destructive" });
        },
      },
    );
  };

  // ── Loading / error states ─────────────────────────────────────────────────
  if (isLoading) {
    return <div className="h-[100dvh] flex justify-center items-center bg-background"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>;
  }

  if (error || !game) {
    return (
      <div className="h-[100dvh] flex flex-col justify-center items-center bg-background gap-4">
        <h2 className="text-2xl font-bold">Game not found</h2>
        <p className="text-muted-foreground">This game may have been removed or the link is invalid.</p>
        <Button onClick={() => window.history.back()}>Go Back</Button>
      </div>
    );
  }

  const genreStyle = GENRE_COLORS[game.genre] || GENRE_COLORS.Platformer;
  const playCount = (game as any).playCount ?? 0;
  const averageRating: number | null = (game as any).averageRating ?? null;
  const ratingCount: number = (game as any).ratingCount ?? 0;

  return (
    <div className="flex flex-col bg-background">
      {/* Rating prompt (modal overlay) */}
      {showRatingPrompt && (
        <RatingPrompt
          gameTitle={game.title}
          onSubmit={handleRatingSubmit}
          onDismiss={() => {
            setShowRatingPrompt(false);
            localStorage.setItem(`rated-${game.id}`, "dismissed");
          }}
          isSubmitting={createReview.isPending}
        />
      )}

      {/* Top bar */}
      <header className="h-14 px-4 bg-background border-b border-border flex items-center justify-between shrink-0 z-10 sticky top-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground shrink-0" onClick={() => window.history.back()} aria-label="Go back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3">
            <h1 className="font-display font-bold text-lg hidden sm:block">{game.title}</h1>
            <span className={cn("px-2 py-0.5 text-[10px] font-semibold rounded-full border hidden md:inline-block", genreStyle)}>
              {game.genre}
            </span>
            <span className="text-sm text-muted-foreground hidden lg:inline">by {game.authorName}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className={cn(
              "border-border bg-card shadow-none transition-colors",
              isLiked ? "border-primary/50 bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary" : "text-muted-foreground hover:text-foreground"
            )}
            onClick={handleLike}
          >
            <Heart className={cn("w-4 h-4 mr-2", isLiked && "fill-primary")} />
            {game.likesCount || 0}
          </Button>
          <Button variant="outline" className="border-border bg-card" onClick={copyShareLink}>
            <Share2 className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Share</span>
          </Button>
        </div>
      </header>

      {/* Game iframe */}
      <div className="w-full bg-black" style={{ height: "70svh" }}>
        <iframe
          srcDoc={game.gameCode}
          className="w-full h-full border-none"
          sandbox="allow-scripts"
          title={game.title}
        />
      </div>

      {/* Stats bar */}
      <div className="px-4 py-2.5 border-b border-border bg-card/50 flex items-center gap-4 text-sm text-muted-foreground">
        {playCount > 0 && (
          <span>{playCount.toLocaleString()} {playCount === 1 ? "play" : "plays"}</span>
        )}
        {averageRating != null && ratingCount > 0 && (
          <span className="flex items-center gap-1">
            <span className="text-yellow-400 font-bold">★ {averageRating.toFixed(1)}</span>
            <span>({ratingCount} {ratingCount === 1 ? "rating" : "ratings"})</span>
          </span>
        )}
        {game.likesCount > 0 && (
          <span>❤ {game.likesCount.toLocaleString()}</span>
        )}
      </div>

      {/* Reviews section */}
      <div className="bg-background">
        <ReviewsSection
          gameId={game.id}
          creatorId={game.authorId}
          averageRating={averageRating}
          ratingCount={ratingCount}
        />
      </div>
    </div>
  );
}
