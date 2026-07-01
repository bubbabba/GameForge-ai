import { useState, useEffect } from "react";
import { useListPublicGames, getListPublicGamesQueryKey } from "@workspace/api-client-react";
import { GAME_GENRES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import GameCard from "@/components/GameCard";
import { Search, Compass, Loader2 } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce"; // Will create this

export default function Explore() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 500);
  const [genre, setGenre] = useState<string>("");

  const { data: games, isLoading } = useListPublicGames(
    { search: debouncedSearch || undefined, genre: genre || undefined },
    { query: { queryKey: getListPublicGamesQueryKey({ search: debouncedSearch || undefined, genre: genre || undefined }) } }
  );

  return (
    <div className="flex-1 px-6 lg:px-12 py-10 max-w-7xl mx-auto w-full">
      <div className="flex flex-col gap-2 mb-10">
        <h1 className="text-4xl font-display font-bold flex items-center gap-3">
          <Compass className="w-8 h-8 text-primary" />
          Explore
        </h1>
        <p className="text-muted-foreground text-lg">Discover games created by the community.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search games..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-card border border-border rounded-lg text-foreground focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all shadow-sm"
          />
        </div>
        
        <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 hide-scrollbar items-center">
          <button
            onClick={() => setGenre("")}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all",
              genre === "" 
                ? "bg-primary text-primary-foreground shadow-[0_0_10px_rgba(34,197,94,0.3)]" 
                : "bg-card border border-border text-muted-foreground hover:bg-white/5"
            )}
          >
            All Genres
          </button>
          {GAME_GENRES.map(g => (
            <button
              key={g}
              onClick={() => setGenre(g)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all",
                genre === g 
                  ? "bg-primary/20 text-primary border border-primary shadow-[0_0_10px_rgba(34,197,94,0.15)]" 
                  : "bg-card border border-border text-muted-foreground hover:bg-white/5"
              )}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      ) : games && games.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {games.map(game => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      ) : (
        <div className="text-center py-24 bg-card/30 border border-dashed border-border rounded-2xl">
          <Compass className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-xl font-bold mb-2">No games found</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            We couldn't find any games matching your search criteria. Try adjusting your filters or search term.
          </p>
        </div>
      )}
    </div>
  );
}