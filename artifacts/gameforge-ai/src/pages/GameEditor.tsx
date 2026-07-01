import { useCallback, useEffect, useRef, useState } from "react";
import { useRoute, Link, useLocation } from "wouter";
import {
  useGetGame,
  useUpdateGame,
  usePublishGame,
  getGetGameQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  ArrowLeft,
  Play,
  Save,
  Globe,
  Code2,
  Circle,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

export default function GameEditor() {
  const [, params] = useRoute("/game/:id");
  const [, setLocation] = useLocation();
  const id = params?.id ? parseInt(params.id, 10) : null;
  const queryClient = useQueryClient();

  const {
    data: game,
    isLoading,
    error,
  } = useGetGame(id!, {
    query: { enabled: !!id, queryKey: getGetGameQueryKey(id!) },
  });

  const updateGame = useUpdateGame();
  const publishGame = usePublishGame();

  // ── Editor state ──────────────────────────────────────────────────────────
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");

  // What's actually loaded in the iframe (only updates on first load + "Run")
  const [previewCode, setPreviewCode] = useState("");
  const [iframeKey, setIframeKey] = useState(0);

  // Track what was last persisted to detect unsaved changes
  const [savedCode, setSavedCode] = useState("");
  const [savedTitle, setSavedTitle] = useState("");

  const [isSaving, setIsSaving] = useState(false);

  const initializedForId = useRef<number | null>(null);

  // Initialise editor & preview from loaded game data
  useEffect(() => {
    if (game && initializedForId.current !== game.id) {
      initializedForId.current = game.id;
      setCode(game.gameCode);
      setTitle(game.title);
      setSavedCode(game.gameCode);
      setSavedTitle(game.title);
      // Load the game immediately into the iframe — no extra click needed
      setPreviewCode(game.gameCode);
      setIframeKey((k) => k + 1);
    }
  }, [game]);

  // ── Dirty detection ───────────────────────────────────────────────────────
  const isDirty = code !== savedCode || title !== savedTitle;

  // ── Save helper (memoised so it's safe in intervals / event handlers) ─────
  const doSave = useCallback(
    (codeSnapshot: string, titleSnapshot: string) => {
      if (!id || isSaving) return;
      setIsSaving(true);
      updateGame.mutate(
        { id, data: { gameCode: codeSnapshot, title: titleSnapshot } },
        {
          onSuccess: (data) => {
            setSavedCode(codeSnapshot);
            setSavedTitle(titleSnapshot);
            queryClient.setQueryData(getGetGameQueryKey(id), data);
          },
          onError: () => {
            toast({
              title: "Auto-save failed",
              description: "Could not save changes. Please save manually.",
              variant: "destructive",
            });
          },
          onSettled: () => setIsSaving(false),
        },
      );
    },
    [id, isSaving, updateGame, queryClient],
  );

  // Keep a ref so the interval always captures the latest values
  const codeRef = useRef(code);
  const titleRef = useRef(title);
  codeRef.current = code;
  titleRef.current = title;

  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  // ── Auto-save every 30 s when there are unsaved changes ───────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      if (isDirtyRef.current && id && !isSaving) {
        doSave(codeRef.current, titleRef.current);
      }
    }, 30_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]); // only re-register when the game id changes

  // ── Manual save ───────────────────────────────────────────────────────────
  const handleSave = () => {
    if (!isDirty) return;
    doSave(code, title);
    toast({ title: "Saved", description: "Draft saved." });
  };

  // ── Run: refresh preview with current editor content ─────────────────────
  const handleRun = () => {
    setPreviewCode(code);
    setIframeKey((k) => k + 1);
  };

  // ── Back navigation — save first if dirty ────────────────────────────────
  const handleBack = () => {
    if (isDirtyRef.current && id && !isSaving) {
      doSave(codeRef.current, titleRef.current);
    }
    setLocation("/my-games");
  };

  // ── Publish ───────────────────────────────────────────────────────────────
  const handlePublish = () => {
    if (!id) return;
    publishGame.mutate(
      { id },
      {
        onSuccess: (data) => {
          toast({
            title: "Game published!",
            description: `Your game is now live at /play/${data.slug}`,
          });
          queryClient.setQueryData(getGetGameQueryKey(id), data);
        },
        onError: (err: any) => {
          toast({
            title: "Publish failed",
            description: err?.error || "Could not publish game.",
            variant: "destructive",
          });
        },
      },
    );
  };

  // ── Loading / error states ────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex-1 flex justify-center items-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="flex-1 flex justify-center items-center text-destructive">
        Error loading game
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-[100dvh] overflow-hidden bg-background">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="h-14 px-4 border-b border-border bg-card flex items-center justify-between shrink-0 gap-3">
        {/* Left: back + title */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={handleBack}
            aria-label="Back to my games"
            className="p-1.5 rounded hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-transparent border-none focus:ring-0 font-display font-bold truncate outline-none text-base min-w-0 w-40 sm:w-64 md:w-80"
              placeholder="Game Title"
              aria-label="Game title"
            />
            <span className="text-xs font-mono text-muted-foreground uppercase shrink-0">
              {game.status}
            </span>
            {/* Unsaved changes indicator */}
            {isDirty && (
              <span
                className="flex items-center gap-1 text-[11px] font-mono text-amber-400/80 shrink-0"
                title="You have unsaved changes — auto-saves every 30 s"
              >
                <Circle className="w-2 h-2 fill-amber-400/80" />
                unsaved
              </span>
            )}
            {isSaving && (
              <Loader2 className="w-3 h-3 text-muted-foreground animate-spin shrink-0" />
            )}
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="border-border text-muted-foreground hover:text-foreground gap-1.5"
            onClick={handleRun}
            title="Reload preview with current code"
          >
            <Play className="w-3.5 h-3.5" />
            Run
          </Button>

          <Button
            variant="outline"
            size="sm"
            className={cn(
              "gap-1.5 transition-colors",
              isDirty
                ? "border-amber-400/40 text-amber-400 hover:bg-amber-400/10"
                : "border-border text-muted-foreground",
            )}
            onClick={handleSave}
            disabled={isSaving || !isDirty}
            title="Save draft now"
          >
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            Save
          </Button>

          {game.status === "draft" && (
            <Button
              size="sm"
              onClick={handlePublish}
              disabled={publishGame.isPending}
              className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 shadow-[0_0_12px_rgba(34,197,94,0.3)]"
            >
              <Globe className="w-3.5 h-3.5" />
              Publish
            </Button>
          )}
        </div>
      </header>

      {/* ── Split pane ──────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Preview panel */}
        <div className="flex-1 border-r border-border bg-black relative flex flex-col min-h-0">
          <div className="absolute top-3 left-3 z-10 px-2.5 py-0.5 bg-black/60 backdrop-blur-md border border-white/10 rounded text-[10px] font-mono text-white/50 uppercase tracking-widest select-none">
            Preview
          </div>
          <iframe
            key={iframeKey}
            srcDoc={previewCode}
            className="w-full h-full border-none"
            sandbox="allow-scripts allow-same-origin"
            title="Game Preview"
          />
        </div>

        {/* Code editor panel */}
        <div className="flex-1 lg:max-w-2xl xl:max-w-3xl flex flex-col bg-[#0d0d0d] min-h-0">
          <div className="h-9 bg-[#111] border-b border-border flex items-center px-4 shrink-0 gap-2">
            <Code2 className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-mono text-muted-foreground">
              index.html
            </span>
          </div>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="flex-1 bg-transparent text-[#e6e6e6] font-mono text-[13px] leading-relaxed p-4 resize-none outline-none focus:ring-0 w-full min-h-0"
            spellCheck={false}
            style={{ tabSize: 2 }}
            aria-label="Game source code"
          />
        </div>
      </div>
    </div>
  );
}
