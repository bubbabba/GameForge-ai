import { Link } from "wouter";
import { Heart, Play, Edit, Trash2, Globe, Share2, Eye } from "lucide-react";
import { useToggleLike, useGetMyLikedGames, getGetMyLikedGamesQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@clerk/react";
import { cn } from "@/lib/utils";
import { GAME_GENRES, GENRE_COLORS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface GameCardProps {
  game: {
    id: number;
    title: string;
    genre: string;
    status: string;
    slug?: string;
    likesCount: number;
    playCount?: number;
    ratingCount?: number;
    averageRating?: number | null;
    authorName: string;
    coverImageUrl?: string | null;
  };
  variant?: "public" | "draft" | "published";
  onDelete?: (id: number) => void;
  onPublish?: (id: number) => void;
}

export default function GameCard({ game, variant = "public", onDelete, onPublish }: GameCardProps) {
  const { isSignedIn } = useAuth();
  const queryClient = useQueryClient();
  const { data: likedGames } = useGetMyLikedGames({ query: { enabled: !!isSignedIn, queryKey: getGetMyLikedGamesQueryKey() } });
  const toggleLike = useToggleLike();

  const isLiked = likedGames?.includes(game.id) || false;
  const genreStyle = GENRE_COLORS[game.genre] || GENRE_COLORS.Platformer;

  // Extract base color from genreStyle (e.g. from "bg-blue-500/20 text-blue-400 border-blue-500/50" to "blue")
  const gradientClass = {
    Platformer: "from-blue-900/50 to-background",
    Shooter: "from-red-900/50 to-background",
    Racing: "from-yellow-900/50 to-background",
    RPG: "from-purple-900/50 to-background",
    Puzzle: "from-cyan-900/50 to-background",
    Adventure: "from-emerald-900/50 to-background",
    Horror: "from-zinc-800/50 to-background",
    Fantasy: "from-pink-900/50 to-background",
  }[game.genre] || "from-primary/20 to-background";

  const handleLike = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!isSignedIn) {
      toast({ title: "Sign in required", description: "You must be signed in to like games.", variant: "destructive" });
      return;
    }
    toggleLike.mutate({ id: game.id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/games/public"] });
        queryClient.invalidateQueries({ queryKey: ["/api/users/me/liked"] });
      }
    });
  };

  const copyShareLink = (e: React.MouseEvent) => {
    e.preventDefault();
    if (game.slug) {
      navigator.clipboard.writeText(`${window.location.origin}/play/${game.slug}`);
      toast({ title: "Link copied", description: "Game link copied to clipboard." });
    }
  };

  return (
    <div className="group flex flex-col bg-card border border-border rounded-xl overflow-hidden hover:border-primary/50 hover:shadow-[0_0_20px_rgba(34,197,94,0.1)] transition-all duration-300 hover:-translate-y-1">
      <div className={cn("h-32 p-4 flex flex-col justify-between relative bg-gradient-to-b overflow-hidden", gradientClass)}>
        {/* AI-generated cover image (shown behind content) */}
        {game.coverImageUrl && (
          <img
            src={`/api/storage${game.coverImageUrl}`}
            alt={`${game.title} cover`}
            className="absolute inset-0 w-full h-full object-cover opacity-60 pointer-events-none"
          />
        )}
        <div className="flex justify-between items-start z-10">
          <span className={cn("px-2.5 py-1 text-xs font-semibold rounded-full border", genreStyle)}>
            {game.genre}
          </span>
          {variant === "public" && (
            <button 
              onClick={handleLike}
              className="w-8 h-8 rounded-full bg-background/50 backdrop-blur-sm border border-white/10 flex items-center justify-center hover:bg-background/80 transition-colors"
            >
              <Heart className={cn("w-4 h-4 transition-colors", isLiked ? "fill-primary text-primary" : "text-muted-foreground")} />
            </button>
          )}
          {variant !== "public" && game.status === "published" && (
            <span className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider bg-primary/20 text-primary border border-primary/30 rounded-md">
              Published
            </span>
          )}
        </div>
      </div>
      
      <div className="p-4 flex-1 flex flex-col">
        <h3 className="font-display font-bold text-lg mb-1 truncate" title={game.title}>{game.title}</h3>
        <p className="text-sm text-muted-foreground mb-4">by {game.authorName}</p>
        
        <div className="mt-auto flex items-center gap-2">
          {variant === "public" ? (
            <>
              <Link href={`/play/${game.slug}`} className="flex-1">
                <Button className="w-full bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground border border-primary/20 hover:border-primary shadow-none transition-all group-hover:shadow-[0_0_15px_rgba(34,197,94,0.3)]">
                  <Play className="w-4 h-4 mr-2" /> Play
                </Button>
              </Link>
              {/* Plays badge */}
              {(game.playCount ?? 0) > 0 && (
                <div className="flex items-center gap-1 px-2.5 h-10 bg-white/5 rounded-md text-xs font-medium text-muted-foreground border border-white/5 shrink-0">
                  <Eye className="w-3.5 h-3.5" />
                  <span>{game.playCount! >= 1000 ? `${(game.playCount! / 1000).toFixed(1)}k` : game.playCount}</span>
                </div>
              )}
              {/* Rating badge */}
              {game.averageRating != null && (game.ratingCount ?? 0) > 0 && (
                <div className="flex items-center gap-1 px-2.5 h-10 bg-yellow-400/10 rounded-md text-xs font-bold text-yellow-400 border border-yellow-400/10 shrink-0">
                  ★ {game.averageRating.toFixed(1)}
                </div>
              )}
            </>
          ) : variant === "draft" ? (
            <>
              <Link href={`/game/${game.id}`} className="flex-1">
                <Button variant="secondary" className="w-full border-border">
                  <Edit className="w-4 h-4 mr-2" /> Edit
                </Button>
              </Link>
              <Button variant="outline" className="border-primary/50 text-primary hover:bg-primary hover:text-primary-foreground" onClick={() => onPublish?.(game.id)}>
                <Globe className="w-4 h-4" />
              </Button>
              <Button variant="destructive" size="icon" onClick={() => onDelete?.(game.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </>
          ) : (
            // Published user game
            <>
              <Link href={`/play/${game.slug}`} className="flex-1">
                <Button variant="secondary" className="w-full border-border hover:bg-white/10">
                  <Play className="w-4 h-4 mr-2" /> Play
                </Button>
              </Link>
              <Button variant="outline" size="icon" onClick={copyShareLink} title="Share Link">
                <Share2 className="w-4 h-4" />
              </Button>
              <Link href={`/game/${game.id}`}>
                <Button variant="outline" size="icon" title="Edit Game">
                  <Edit className="w-4 h-4" />
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}