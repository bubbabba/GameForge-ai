import {
  useCallback,
  useEffect,
  useRef,
  useState,
  KeyboardEvent,
} from "react";
import { useRoute, useLocation } from "wouter";
import {
  useGetGame,
  useUpdateGame,
  usePublishGame,
  useChatEditGame,
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
  Send,
  Bot,
  User,
  RotateCcw,
  Sparkles,
  ChevronRight,
  ChevronDown,
  FileCode,
  Settings2,
  Gamepad2,
  Palette,
  Volume2,
  Zap,
  Shield,
  FolderOpen,
  AlertTriangle,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

// ── Chat message type ─────────────────────────────────────────────────────────
type ChatRole = "user" | "assistant" | "error";
interface ChatMessage {
  id: number;
  role: ChatRole;
  text: string;
  undoable?: boolean;
}

let msgIdCounter = 0;
function newMsg(role: ChatRole, text: string, undoable = false): ChatMessage {
  return { id: ++msgIdCounter, role, text, undoable };
}

const WELCOME: ChatMessage = newMsg(
  "assistant",
  "Hi! I'm your game AI. Type a request below and I'll update your game instantly.\n\nTry things like: \"make the player faster\", \"add a double jump\", \"change the background to a forest\", or \"make the enemies harder\".",
);

// ── Sidebar ───────────────────────────────────────────────────────────────────
function Sidebar() {
  const [filesOpen, setFilesOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <aside className="w-44 shrink-0 bg-[#111] border-r border-white/10 flex flex-col text-xs overflow-y-auto">
      {/* Files */}
      <button
        onClick={() => setFilesOpen((o) => !o)}
        className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold text-white/40 uppercase tracking-wider hover:text-white/60 transition-colors w-full"
      >
        {filesOpen ? (
          <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronRight className="w-3 h-3" />
        )}
        Files
      </button>
      {filesOpen && (
        <div className="pb-1">
          <div className="flex items-center gap-1.5 px-4 py-1 text-emerald-400 bg-emerald-400/10 cursor-default rounded-sm mx-1">
            <FileCode className="w-3 h-3 shrink-0" />
            <span className="truncate">index.html</span>
          </div>
          <div className="flex items-center gap-1.5 px-4 py-1 text-white/30 cursor-default">
            <FolderOpen className="w-3 h-3 shrink-0" />
            <span className="truncate text-white/25">assets/</span>
          </div>
        </div>
      )}

      <div className="border-t border-white/10 mx-2" />

      {/* Settings */}
      <button
        onClick={() => setSettingsOpen((o) => !o)}
        className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold text-white/40 uppercase tracking-wider hover:text-white/60 transition-colors w-full"
      >
        {settingsOpen ? (
          <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronRight className="w-3 h-3" />
        )}
        Settings
      </button>
      {settingsOpen && (
        <div className="px-3 pb-3 space-y-3">
          <div>
            <p className="text-[10px] text-white/25 uppercase tracking-wider mb-1">
              Ask AI to change
            </p>
            {[
              { icon: Palette, label: "Theme & Colors" },
              { icon: Volume2, label: "Sound & Music" },
              { icon: Shield, label: "Difficulty" },
              { icon: Zap, label: "Physics" },
              { icon: Settings2, label: "Controls" },
            ].map(({ icon: Icon, label }) => (
              <button
                key={label}
                className="w-full flex items-center gap-2 px-2 py-1 rounded text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
                title={`Ask AI: change ${label.toLowerCase()}`}
              >
                <Icon className="w-3 h-3 shrink-0" />
                <span className="truncate">{label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-auto border-t border-white/10 mx-2" />
      <div className="p-2 text-[10px] text-white/20 text-center pb-3">
        <Gamepad2 className="w-4 h-4 text-emerald-400/40 mx-auto mb-1" />
        GameForge AI
      </div>
    </aside>
  );
}

// ── Chat panel ────────────────────────────────────────────────────────────────
interface ChatPanelProps {
  messages: ChatMessage[];
  isThinking: boolean;
  onSend: (text: string) => void;
  onUndo: () => void;
  canUndo: boolean;
}

function ChatPanel({
  messages,
  isThinking,
  onSend,
  onUndo,
  canUndo,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || isThinking) return;
    setInput("");
    onSend(text);
    // Re-focus after send
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col border-t border-white/10 bg-[#0f0f0f]" style={{ height: 260 }}>
      {/* Panel header */}
      <div className="h-8 bg-[#111] border-b border-white/10 flex items-center px-3 gap-2 shrink-0">
        <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
        <span className="text-[11px] font-mono text-white/60 font-semibold">
          AI Game Assistant
        </span>
        <span className="ml-auto text-[10px] text-emerald-400/60 font-mono">
          claude-sonnet
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 min-h-0">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn("flex gap-2", msg.role === "user" && "flex-row-reverse")}
          >
            {/* Avatar */}
            <div
              className={cn(
                "shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5",
                msg.role === "assistant" && "bg-emerald-400/20",
                msg.role === "user" && "bg-white/10",
                msg.role === "error" && "bg-red-900/40",
              )}
            >
              {msg.role === "assistant" && (
                <Bot className="w-3 h-3 text-emerald-400" />
              )}
              {msg.role === "user" && (
                <User className="w-3 h-3 text-white/60" />
              )}
              {msg.role === "error" && (
                <AlertTriangle className="w-3 h-3 text-red-400" />
              )}
            </div>

            {/* Bubble */}
            <div
              className={cn(
                "max-w-[80%] rounded-lg px-2.5 py-1.5 text-[12px] leading-relaxed whitespace-pre-wrap",
                msg.role === "user" && "bg-emerald-400/10 text-white/80",
                msg.role === "assistant" && "bg-white/5 text-white/75",
                msg.role === "error" && "bg-red-900/30 text-red-300 border border-red-800/40",
              )}
            >
              {msg.text}
              {msg.undoable && canUndo && (
                <button
                  onClick={onUndo}
                  className="mt-1.5 flex items-center gap-1 text-[11px] text-white/35 hover:text-white/65 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  Undo this change
                </button>
              )}
            </div>
          </div>
        ))}

        {isThinking && (
          <div className="flex gap-2">
            <div className="shrink-0 w-5 h-5 rounded-full bg-emerald-400/20 flex items-center justify-center">
              <Loader2 className="w-3 h-3 text-emerald-400 animate-spin" />
            </div>
            <div className="bg-white/5 rounded-lg px-2.5 py-1.5 text-[12px] text-white/40 flex items-center gap-1.5">
              <span>Thinking</span>
              <span className="inline-flex gap-0.5 mt-0.5">
                {[0, 1, 2].map((n) => (
                  <span
                    key={n}
                    className="w-1 h-1 rounded-full bg-white/30 animate-bounce"
                    style={{ animationDelay: `${n * 0.15}s` }}
                  />
                ))}
              </span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input row */}
      <div className="px-3 pb-2.5 pt-1.5 shrink-0">
        <div
          className={cn(
            "flex gap-2 items-end bg-white/5 rounded-lg px-3 py-2 border border-white/10 transition-colors",
            "focus-within:border-emerald-400/40",
          )}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder='e.g. "make the player faster"   (Enter to send, Shift+Enter for new line)'
            rows={1}
            className="flex-1 bg-transparent text-[12px] text-white/75 placeholder:text-white/25 outline-none resize-none leading-5"
            style={{ maxHeight: 80 }}
            disabled={isThinking}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isThinking}
            className="shrink-0 w-7 h-7 rounded-md flex items-center justify-center bg-emerald-500 hover:bg-emerald-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors mb-0.5"
            title="Send (Enter)"
          >
            <Send className="w-3.5 h-3.5 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main editor ───────────────────────────────────────────────────────────────
export default function GameEditor() {
  const [, params] = useRoute("/game/:id");
  const [, setLocation] = useLocation();
  const id = params?.id ? parseInt(params.id, 10) : null;
  const queryClient = useQueryClient();

  const { data: game, isLoading, error } = useGetGame(id!, {
    query: { enabled: !!id, queryKey: getGetGameQueryKey(id!) },
  });

  const updateGame = useUpdateGame();
  const publishGame = usePublishGame();
  const chatEdit = useChatEditGame();

  // ── Editor state ──────────────────────────────────────────────────────────
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");

  // What's loaded in the iframe (updates on first load + explicit Run + AI updates)
  const [previewCode, setPreviewCode] = useState("");
  const [iframeKey, setIframeKey] = useState(0);

  // Dirty / save tracking
  const [savedCode, setSavedCode] = useState("");
  const [savedTitle, setSavedTitle] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [isThinking, setIsThinking] = useState(false);

  // Undo stack — store up to 20 previous code snapshots before AI edits
  const undoStack = useRef<string[]>([]);

  const initializedForId = useRef<number | null>(null);

  // Initialise from loaded game
  useEffect(() => {
    if (game && initializedForId.current !== game.id) {
      initializedForId.current = game.id;
      setCode(game.gameCode);
      setTitle(game.title);
      setSavedCode(game.gameCode);
      setSavedTitle(game.title);
      setPreviewCode(game.gameCode);
      setIframeKey((k) => k + 1);
    }
  }, [game]);

  const isDirty = code !== savedCode || title !== savedTitle;

  // Keep refs for interval / event handlers
  const codeRef = useRef(code);
  const titleRef = useRef(title);
  codeRef.current = code;
  titleRef.current = title;
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  // ── Save helper ───────────────────────────────────────────────────────────
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

  // Auto-save every 30 s
  useEffect(() => {
    const interval = setInterval(() => {
      if (isDirtyRef.current && id && !isSaving) {
        doSave(codeRef.current, titleRef.current);
      }
    }, 30_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleSave = () => {
    if (!isDirty) return;
    doSave(code, title);
    toast({ title: "Saved", description: "Draft saved." });
  };

  const handleRun = () => {
    setPreviewCode(code);
    setIframeKey((k) => k + 1);
  };

  const handleBack = () => {
    if (isDirtyRef.current && id && !isSaving) {
      doSave(codeRef.current, titleRef.current);
    }
    setLocation("/my-games");
  };

  const handlePublish = () => {
    if (!id) return;
    const doPublish = () => {
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

    if (isDirty) {
      // Save first, then publish once the save completes
      setIsSaving(true);
      updateGame.mutate(
        { id, data: { gameCode: code, title } },
        {
          onSuccess: (data) => {
            setSavedCode(code);
            setSavedTitle(title);
            queryClient.setQueryData(getGetGameQueryKey(id), data);
            doPublish();
          },
          onError: () => {
            toast({
              title: "Save failed before publish",
              description: "Could not save changes. Please try again.",
              variant: "destructive",
            });
          },
          onSettled: () => setIsSaving(false),
        },
      );
    } else {
      doPublish();
    }
  };

  // ── Undo ─────────────────────────────────────────────────────────────────
  const handleUndo = useCallback(() => {
    const prev = undoStack.current.pop();
    if (!prev) return;
    setCode(prev);
    setPreviewCode(prev);
    setIframeKey((k) => k + 1);
    // Auto-save the reverted version
    if (id) doSave(prev, titleRef.current);
    setMessages((m) => [
      ...m,
      newMsg("assistant", "↩ Reverted to the previous version."),
    ]);
  }, [id, doSave]);

  // ── AI chat send ──────────────────────────────────────────────────────────
  const handleChatSend = useCallback(
    (text: string) => {
      if (!id || isThinking) return;

      setMessages((m) => [...m, newMsg("user", text)]);
      setIsThinking(true);

      // Push current code onto undo stack before AI overwrites it
      undoStack.current.push(codeRef.current);
      if (undoStack.current.length > 20) undoStack.current.shift();

      chatEdit.mutate(
        { id, data: { message: text, currentCode: codeRef.current } },
        {
          onSuccess: (data) => {
            setIsThinking(false);
            const updated = data.updatedCode;

            // Apply the new code
            setCode(updated);
            setPreviewCode(updated);
            setIframeKey((k) => k + 1);

            // Auto-save
            doSave(updated, titleRef.current);

            setMessages((m) => [
              ...m,
              newMsg(
                "assistant",
                `✓ Done! Applied your change and refreshed the preview.`,
                true, // undoable
              ),
            ]);
          },
          onError: (err: any) => {
            setIsThinking(false);
            // Pop from undo stack since we didn't apply a change
            undoStack.current.pop();

            const detail =
              err?.error || err?.message || "The AI couldn't apply that change.";
            setMessages((m) => [
              ...m,
              newMsg(
                "error",
                `❌ ${detail}\n\nYou can try rephrasing, or be more specific about what you want to change.`,
              ),
            ]);
          },
        },
      );
    },
    [id, isThinking, chatEdit, doSave],
  );

  // ── Loading / error states ────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex-1 flex justify-center items-center h-screen bg-background">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="flex-1 flex justify-center items-center h-screen text-destructive">
        Error loading game
      </div>
    );
  }

  const canUndo = undoStack.current.length > 0;

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden bg-[#0a0a0a] text-white">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="h-12 px-4 border-b border-white/10 bg-[#111] flex items-center justify-between shrink-0 gap-3">
        {/* Left: back + title */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={handleBack}
            aria-label="Back to my games"
            className="p-1.5 rounded hover:bg-white/5 text-white/40 hover:text-white/70 transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <Gamepad2 className="w-4 h-4 text-emerald-400 shrink-0" />

          <div className="flex items-center gap-2 min-w-0">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-transparent border-none focus:ring-0 font-bold truncate outline-none text-sm min-w-0 w-40 sm:w-64 text-white"
              placeholder="Game Title"
              aria-label="Game title"
            />
            <span className="text-[10px] font-mono text-white/30 uppercase shrink-0">
              {game.status}
            </span>
            {isDirty && (
              <span
                className="flex items-center gap-1 text-[11px] font-mono text-amber-400/70 shrink-0"
                title="You have unsaved changes — auto-saves every 30 s"
              >
                <Circle className="w-2 h-2 fill-amber-400/70" />
                unsaved
              </span>
            )}
            {isSaving && (
              <Loader2 className="w-3 h-3 text-white/30 animate-spin shrink-0" />
            )}
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="border-white/15 text-white/50 hover:text-white/80 hover:bg-white/5 gap-1.5 h-8"
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
              "gap-1.5 h-8 transition-colors",
              isDirty
                ? "border-amber-400/40 text-amber-400 hover:bg-amber-400/10"
                : "border-white/15 text-white/40",
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

          {canUndo && (
            <Button
              variant="outline"
              size="sm"
              className="border-white/15 text-white/40 hover:text-white/70 gap-1.5 h-8"
              onClick={handleUndo}
              title="Undo last AI change"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Undo
            </Button>
          )}

          {game.status === "draft" && (
            <Button
              size="sm"
              onClick={handlePublish}
              disabled={publishGame.isPending}
              className="bg-emerald-500 hover:bg-emerald-400 text-white gap-1.5 h-8 shadow-[0_0_12px_rgba(34,197,94,0.25)]"
            >
              <Globe className="w-3.5 h-3.5" />
              Publish
            </Button>
          )}
        </div>
      </header>

      {/* ── 4-panel body ────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* Left: file explorer + settings */}
        <Sidebar />

        {/* Center column: preview (top) + AI chat (bottom) */}
        <div className="flex flex-col flex-1 min-w-0 min-h-0">

          {/* Preview area */}
          <div className="flex-1 bg-black relative overflow-hidden min-h-0">
            <div className="absolute top-2 left-2 z-10 px-2 py-0.5 bg-black/60 backdrop-blur-md border border-white/10 rounded text-[9px] font-mono text-white/40 uppercase tracking-widest select-none pointer-events-none">
              Live Preview
            </div>
            {isThinking && (
              <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5 px-2.5 py-1 bg-emerald-900/60 border border-emerald-400/30 rounded text-[10px] font-mono text-emerald-300 backdrop-blur-md">
                <Sparkles className="w-3 h-3 animate-pulse" />
                AI is updating…
              </div>
            )}
            <iframe
              key={iframeKey}
              srcDoc={previewCode}
              className="w-full h-full border-none"
              sandbox="allow-scripts"
              title="Game Preview"
            />
          </div>

          {/* AI chat panel */}
          <ChatPanel
            messages={messages}
            isThinking={isThinking}
            onSend={handleChatSend}
            onUndo={handleUndo}
            canUndo={canUndo}
          />
        </div>

        {/* Right: code editor */}
        <div
          className="flex flex-col bg-[#0d0d0d] border-l border-white/10 min-h-0"
          style={{ width: 340 }}
        >
          <div className="h-8 bg-[#111] border-b border-white/10 flex items-center px-3 shrink-0 gap-2">
            <Code2 className="w-3.5 h-3.5 text-white/30" />
            <span className="text-[11px] font-mono text-white/40">
              index.html
            </span>
            {isThinking && (
              <span className="ml-auto text-[10px] text-emerald-400/70 font-mono animate-pulse">
                ● updating…
              </span>
            )}
          </div>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            readOnly={isThinking}
            className={cn(
              "flex-1 bg-transparent text-[#d4d4d4] font-mono text-[12px] leading-relaxed p-4 resize-none outline-none focus:ring-0 w-full min-h-0 transition-opacity",
              isThinking && "opacity-50 cursor-not-allowed",
            )}
            spellCheck={false}
            style={{ tabSize: 2 }}
            aria-label="Game source code"
            title={isThinking ? "AI is updating the code…" : undefined}
          />
        </div>
      </div>
    </div>
  );
}
