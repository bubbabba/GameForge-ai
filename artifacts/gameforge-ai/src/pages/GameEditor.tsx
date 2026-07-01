import { useEffect, useRef, useState } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { useGetGame, useUpdateGame, usePublishGame, getGetGameQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Play, Save, Globe, Code2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function GameEditor() {
  const [, params] = useRoute("/game/:id");
  const [, setLocation] = useLocation();
  const id = params?.id ? parseInt(params.id, 10) : null;
  const queryClient = useQueryClient();

  const { data: game, isLoading, error } = useGetGame(id!, { 
    query: { 
      enabled: !!id, 
      queryKey: getGetGameQueryKey(id!) 
    } 
  });

  const updateGame = useUpdateGame();
  const publishGame = usePublishGame();

  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [iframeKey, setIframeKey] = useState(0); // For forcing iframe reload

  const initializedForId = useRef<number | null>(null);

  useEffect(() => {
    if (game && initializedForId.current !== game.id) {
      initializedForId.current = game.id;
      setCode(game.gameCode);
      setTitle(game.title);
    }
  }, [game]);

  const handleApplyChanges = () => {
    if (!id) return;
    
    // We update the iframe local state first
    setIframeKey(k => k + 1);
    
    // And persist to backend
    updateGame.mutate({ id, data: { gameCode: code, title } }, {
      onSuccess: (data) => {
        toast({ title: "Changes applied", description: "Your code has been saved and preview updated." });
        queryClient.setQueryData(getGetGameQueryKey(id), data);
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to save changes.", variant: "destructive" });
      }
    });
  };

  const handlePublish = () => {
    if (!id) return;
    
    publishGame.mutate({ id }, {
      onSuccess: (data) => {
        toast({ title: "Game published!", description: "Your game is now live." });
        queryClient.setQueryData(getGetGameQueryKey(id), data);
        setLocation(`/play/${data.slug}`);
      },
      onError: (err: any) => {
        toast({ title: "Publish failed", description: err?.error || "Could not publish game.", variant: "destructive" });
      }
    });
  };

  if (isLoading) {
    return <div className="flex-1 flex justify-center items-center"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>;
  }

  if (error || !game) {
    return <div className="flex-1 flex justify-center items-center text-destructive">Error loading game</div>;
  }

  return (
    <div className="flex-1 flex flex-col h-[100dvh] overflow-hidden bg-background">
      {/* Editor Header */}
      <header className="h-16 px-4 border-b border-border bg-card flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/my-games">
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex flex-col max-w-sm">
            <input 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-transparent border-none focus:ring-0 text-lg font-display font-bold truncate outline-none"
              placeholder="Game Title"
            />
            <span className="text-xs text-muted-foreground font-mono">{game.status.toUpperCase()}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            className="border-primary/50 text-primary hover:bg-primary/10"
            onClick={handleApplyChanges}
            disabled={updateGame.isPending}
          >
            {updateGame.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
            Apply Changes
          </Button>
          
          {game.status === "draft" && (
            <Button 
              onClick={handlePublish} 
              disabled={publishGame.isPending}
              className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_15px_rgba(34,197,94,0.3)]"
            >
              <Globe className="w-4 h-4 mr-2" />
              Publish
            </Button>
          )}
        </div>
      </header>

      {/* Editor Split Pane */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Preview Panel */}
        <div className="flex-1 border-r border-border bg-black relative flex flex-col">
          <div className="absolute top-4 left-4 z-10 px-3 py-1 bg-black/50 backdrop-blur-md border border-white/10 rounded text-xs font-mono text-white/70">
            PREVIEW
          </div>
          <iframe
            key={iframeKey}
            srcDoc={code}
            className="w-full h-full border-none"
            sandbox="allow-scripts allow-same-origin"
            title="Game Preview"
          />
        </div>

        {/* Code Editor Panel */}
        <div className="flex-1 lg:max-w-2xl xl:max-w-3xl flex flex-col bg-[#0d0d0d]">
          <div className="h-10 bg-[#111] border-b border-border flex items-center px-4 shrink-0">
            <Code2 className="w-4 h-4 text-muted-foreground mr-2" />
            <span className="text-sm font-mono text-muted-foreground">index.html</span>
          </div>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="flex-1 bg-transparent text-[#e6e6e6] font-mono text-[13px] leading-relaxed p-4 resize-none outline-none focus:ring-0 w-full"
            spellCheck={false}
            style={{ tabSize: 2 }}
          />
        </div>
      </div>
    </div>
  );
}