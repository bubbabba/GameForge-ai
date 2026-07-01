import { useGetMyLikedGames, useListPublicGames, getGetMyLikedGamesQueryKey, getListPublicGamesQueryKey } from "@workspace/api-client-react";
import GameCard from "@/components/GameCard";
import { Heart, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function Favorites() {
  const { data: likedIds, isLoading: loadingLikes } = useGetMyLikedGames({ query: { queryKey: getGetMyLikedGamesQueryKey() } });
  
  // We fetch all public games and filter them. In a real app we'd want an API endpoint for /api/games/liked
  // but we can use listPublicGames and filter locally given the available endpoints.
  const { data: publicGames, isLoading: loadingGames } = useListPublicGames(undefined, {
    query: { enabled: !!likedIds && likedIds.length > 0, queryKey: getListPublicGamesQueryKey() }
  });

  const isLoading = loadingLikes || (likedIds && likedIds.length > 0 && loadingGames);

  const favoriteGames = publicGames?.filter(game => likedIds?.includes(game.id)) || [];

  return (
    <div className="flex-1 px-6 lg:px-12 py-10 max-w-7xl mx-auto w-full">
      <div className="mb-10">
        <h1 className="text-4xl font-display font-bold flex items-center gap-3">
          <Heart className="w-8 h-8 text-rose-500 fill-rose-500" />
          Favorites
        </h1>
        <p className="text-muted-foreground text-lg mt-2">Games you've liked from the community.</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      ) : favoriteGames.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {favoriteGames.map(game => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      ) : (
        <div className="text-center py-24 bg-card/30 border border-dashed border-border rounded-2xl">
          <Heart className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-xl font-bold mb-2">No favorites yet</h3>
          <p className="text-muted-foreground max-w-md mx-auto mb-6">
            You haven't liked any games yet. Explore the community and find some inspiration!
          </p>
          <Link href="/explore">
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
              Explore Games
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}