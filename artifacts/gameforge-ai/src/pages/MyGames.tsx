import { useListMyGames, useDeleteGame, usePublishGame, getListMyGamesQueryKey } from "@workspace/api-client-react";
import GameCard from "@/components/GameCard";
import { Gamepad2, Loader2, Plus } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState } from "react";

export default function MyGames() {
  const queryClient = useQueryClient();
  const { data: games, isLoading } = useListMyGames({ query: { queryKey: getListMyGamesQueryKey() } });
  const deleteGame = useDeleteGame();
  const publishGame = usePublishGame();
  
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const drafts = games?.filter(g => g.status === "draft") || [];
  const published = games?.filter(g => g.status === "published") || [];

  const handlePublish = (id: number) => {
    publishGame.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Game published!", description: "Your game is now live in the community." });
        queryClient.invalidateQueries({ queryKey: ["/api/games/my"] });
      },
      onError: (err: any) => {
        toast({ title: "Publish failed", description: err?.error || "Failed to publish game.", variant: "destructive" });
      }
    });
  };

  const confirmDelete = () => {
    if (deleteId) {
      deleteGame.mutate({ id: deleteId }, {
        onSuccess: () => {
          toast({ title: "Game deleted", description: "Your game has been removed." });
          queryClient.invalidateQueries({ queryKey: ["/api/games/my"] });
          setDeleteId(null);
        },
        onError: (err: any) => {
          toast({ title: "Delete failed", description: err?.error || "Failed to delete game.", variant: "destructive" });
          setDeleteId(null);
        }
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex justify-center items-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 px-6 lg:px-12 py-10 max-w-7xl mx-auto w-full">
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-4xl font-display font-bold flex items-center gap-3">
            <Gamepad2 className="w-8 h-8 text-primary" />
            My Games
          </h1>
          <p className="text-muted-foreground text-lg mt-2">Manage your drafts and published creations.</p>
        </div>
        <Link href="/">
          <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_15px_rgba(34,197,94,0.3)]">
            <Plus className="w-4 h-4 mr-2" /> New Game
          </Button>
        </Link>
      </div>

      <div className="space-y-12">
        <section>
          <h2 className="text-2xl font-display font-bold mb-6 pb-2 border-b border-border">Drafts</h2>
          {drafts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {drafts.map(game => (
                <GameCard 
                  key={game.id} 
                  game={game} 
                  variant="draft" 
                  onDelete={() => setDeleteId(game.id)}
                  onPublish={() => handlePublish(game.id)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-card/30 border border-dashed border-border rounded-xl">
              <p className="text-muted-foreground">You don't have any drafts. Start creating!</p>
            </div>
          )}
        </section>

        <section>
          <h2 className="text-2xl font-display font-bold mb-6 pb-2 border-b border-border">Published</h2>
          {published.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {published.map(game => (
                <GameCard 
                  key={game.id} 
                  game={game} 
                  variant="published" 
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-card/30 border border-dashed border-border rounded-xl">
              <p className="text-muted-foreground">You haven't published any games yet.</p>
            </div>
          )}
        </section>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your draft game.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-border hover:bg-white/5">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}