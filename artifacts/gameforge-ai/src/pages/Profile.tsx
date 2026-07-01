import { useGetMe, useListMyGames, getGetMeQueryKey } from "@workspace/api-client-react";
import { useUser } from "@clerk/react";
import { Loader2, User as UserIcon, Gamepad2, Globe, Heart, FileEdit } from "lucide-react";
import GameCard from "@/components/GameCard";

export default function Profile() {
  const { user } = useUser();
  const { data: stats, isLoading: loadingStats } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });
  const { data: games, isLoading: loadingGames } = useListMyGames();

  const published = games?.filter(g => g.status === "published") || [];

  if (loadingStats || loadingGames) {
    return <div className="flex-1 flex justify-center items-center"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>;
  }

  return (
    <div className="flex-1 px-6 lg:px-12 py-12 max-w-7xl mx-auto w-full">
      {/* Profile Header */}
      <div className="flex flex-col md:flex-row items-center md:items-start gap-8 mb-16 bg-card border border-border p-8 rounded-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
        
        <div className="w-32 h-32 rounded-full bg-primary/20 border-4 border-background shadow-[0_0_30px_rgba(34,197,94,0.2)] flex items-center justify-center relative z-10 shrink-0">
          <span className="text-5xl font-bold text-primary font-display">
            {user?.firstName?.charAt(0) || user?.username?.charAt(0) || "U"}
          </span>
        </div>
        
        <div className="flex-1 text-center md:text-left z-10">
          <h1 className="text-4xl font-display font-bold mb-2">{user?.firstName || user?.username || "Anonymous Creator"}</h1>
          <p className="text-muted-foreground mb-6">Joined {new Date(user?.createdAt || Date.now()).toLocaleDateString()}</p>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-background border border-border p-4 rounded-xl text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-2 text-muted-foreground mb-1">
                <Gamepad2 className="w-4 h-4" />
                <span className="text-sm font-medium">Total Games</span>
              </div>
              <p className="text-2xl font-bold font-display">{stats?.totalGames || 0}</p>
            </div>
            
            <div className="bg-background border border-border p-4 rounded-xl text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-2 text-primary mb-1">
                <Globe className="w-4 h-4" />
                <span className="text-sm font-medium text-foreground">Published</span>
              </div>
              <p className="text-2xl font-bold font-display text-primary">{stats?.publishedGames || 0}</p>
            </div>
            
            <div className="bg-background border border-border p-4 rounded-xl text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-2 text-muted-foreground mb-1">
                <FileEdit className="w-4 h-4" />
                <span className="text-sm font-medium">Drafts</span>
              </div>
              <p className="text-2xl font-bold font-display">{stats?.draftGames || 0}</p>
            </div>
            
            <div className="bg-background border border-border p-4 rounded-xl text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-2 text-rose-500 mb-1">
                <Heart className="w-4 h-4" />
                <span className="text-sm font-medium text-foreground">Likes Received</span>
              </div>
              <p className="text-2xl font-bold font-display">{stats?.totalLikes || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Public Games */}
      <div>
        <h2 className="text-2xl font-display font-bold mb-6 pb-2 border-b border-border">Public Showcase</h2>
        {published.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {published.map(game => (
              <GameCard key={game.id} game={game} variant="public" />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-card/30 border border-dashed border-border rounded-xl">
            <p className="text-muted-foreground">You haven't published any games yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}