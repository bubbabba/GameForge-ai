import { useRoute } from "wouter";
import { useGetGameBySlug, useToggleLike, useGetMyLikedGames, getGetMyLikedGamesQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@clerk/react";
import { Loader2, Heart, Share2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { GAME_GENRES, GENRE_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export default function PlayGame() {
  const [, params] = useRoute("/play/:slug");
  const slug = params?.slug;
  const { isSignedIn } = useAuth();
  const queryClient = useQueryClient();

  const { data: game, isLoading, error } = useGetGameBySlug(slug!, {
    query: { enabled: !!slug, queryKey: ["/api/games/slug", slug] } // Orval didn't export getGetGameBySlugQueryKey correctly? We'll use the raw array. Wait, I saw it in the file. Let me check the exact name.
  });

  const { data: likedGames } = useGetMyLikedGames({ query: { enabled: !!isSignedIn, queryKey: getGetMyLikedGamesQueryKey() } });
  const toggleLike = useToggleLike();

  const isLiked = game && likedGames?.includes(game.id);

  const handleLike = () => {
    if (!isSignedIn) {
      toast({ title: "Sign in required", description: "You must be signed in to like games.", variant: "destructive" });
      return;
    }
    if (!game) return;

    toggleLike.mutate({ id: game.id }, {
      onSuccess: (data) => {
        // Update local game cache with new likesCount
        queryClient.setQueryData(["/api/games/slug", slug], (old: any) => 
          old ? { ...old, likesCount: data.likesCount } : old
        );
        queryClient.invalidateQueries({ queryKey: ["/api/users/me/liked"] });
      }
    });
  };

  const copyShareLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast({ title: "Link copied", description: "Game link copied to clipboard." });
  };

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

  return (
    <div className="flex flex-col h-[100dvh] bg-black">
      {/* Slim Top Bar */}
      <header className="h-14 px-4 bg-background border-b border-border flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground shrink-0" onClick={() => window.history.back()}>
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

      {/* Game Iframe */}
      <main className="flex-1 w-full bg-black relative">
        <iframe
          srcDoc={game.gameCode}
          className="w-full h-full border-none"
          sandbox="allow-scripts"
          title={game.title}
        />
      </main>
    </div>
  );
}