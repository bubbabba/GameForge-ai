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
  getGetGameQueryKey,
} from "@workspace/api-client-react";
import { streamPost } from "@/lib/streamPost";
import { apiFetch } from "@/lib/apiFetch";
import { Button } from "@/components/ui/button";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import CodeMirror from "@uiw/react-codemirror";
import { html as htmlLang } from "@codemirror/lang-html";
import { oneDark } from "@codemirror/theme-one-dark";
import {
  Loader2,
  ArrowLeft,
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
  Redo2,
  RefreshCcw,
  Copy,
  Maximize2,
  Minimize2,
  Mic,
  MicOff,
  X,
  ImageIcon,
  Wand2,
  Plus,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useQueryClient, useMutation } from "@tanstack/react-query";
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

function makeWelcome(gamePlan?: string | null): ChatMessage {
  if (gamePlan) {
    return newMsg(
      "assistant",
      `Here is what I built:\n\n${gamePlan}\n\n---\nAsk me to change anything — try: "make it harder", "add power-ups", "change the colors", "add a new enemy", or "make the player faster".`,
    );
  }
  return newMsg(
    "assistant",
    'Hi! I\'m your game AI. Describe a change and I\'ll update your game instantly.\n\nTry: "make the player faster", "add a double jump", "change the background to a forest", or "make the enemies harder".',
  );
}

const QUICK_CHIPS = [
  "Make it harder",
  "Add power up",
  "Make it faster",
  "Add new enemy",
  "Change colors",
  "Add sound effects",
  "Fix any bugs",
  "Add a second level",
];

// ── Sidebar ───────────────────────────────────────────────────────────────────
interface SidebarProps {
  coverImageUrl: string | null;
  isGeneratingCover: boolean;
  onRegenerateCover: () => void;
  sprites: Array<{ url: string; description: string }>;
  isGeneratingSprite: boolean;
  onGenerateSprite: (description: string) => void;
  onAddSpriteToGame: (url: string, description: string) => void;
}

function Sidebar({
  coverImageUrl,
  isGeneratingCover,
  onRegenerateCover,
  sprites,
  isGeneratingSprite,
  onGenerateSprite,
  onAddSpriteToGame,
}: SidebarProps) {
  const [filesOpen, setFilesOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [spritesOpen, setSpritesOpen] = useState(false);
  const [spriteInput, setSpriteInput] = useState("");

  return (
    <aside className="w-44 shrink-0 bg-[#111] border-r border-white/10 flex flex-col text-xs overflow-y-auto">
      {/* Cover image */}
      <div className="p-2 border-b border-white/10">
        {coverImageUrl ? (
          <div
            className={`relative group rounded overflow-hidden ${isGeneratingCover ? "cursor-not-allowed" : "cursor-pointer"}`}
            onClick={isGeneratingCover ? undefined : onRegenerateCover}
          >
            <img
              src={`/api/storage${coverImageUrl}`}
              alt="Game cover"
              className="w-full h-20 object-cover rounded"
            />
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1 transition-opacity rounded">
              {isGeneratingCover ? (
                <Loader2 className="w-3 h-3 animate-spin text-white" />
              ) : (
                <RefreshCcw className="w-3 h-3 text-white" />
              )}
              <span className="text-[10px] text-white">
                {isGeneratingCover ? "Generating…" : "New Cover"}
              </span>
            </div>
          </div>
        ) : (
          <button
            onClick={onRegenerateCover}
            disabled={isGeneratingCover}
            className="w-full h-16 rounded border border-dashed border-white/20 flex flex-col items-center justify-center gap-1 text-white/30 hover:text-white/50 hover:border-white/30 disabled:opacity-40 transition-colors"
          >
            {isGeneratingCover ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                <span className="text-[9px]">Generating…</span>
              </>
            ) : (
              <>
                <ImageIcon className="w-3 h-3" />
                <span className="text-[9px]">Generate Cover</span>
              </>
            )}
          </button>
        )}
      </div>

      <button
        onClick={() => setFilesOpen((o) => !o)}
        className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold text-white/40 uppercase tracking-wider hover:text-white/60 transition-colors w-full"
      >
        {filesOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
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

      <button
        onClick={() => setSettingsOpen((o) => !o)}
        className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold text-white/40 uppercase tracking-wider hover:text-white/60 transition-colors w-full"
      >
        {settingsOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        Settings
      </button>
      {settingsOpen && (
        <div className="px-3 pb-3 space-y-1">
          <p className="text-[10px] text-white/25 uppercase tracking-wider mb-1 pt-1">Ask AI to change</p>
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
            >
              <Icon className="w-3 h-3 shrink-0" />
              <span className="truncate">{label}</span>
            </button>
          ))}
        </div>
      )}

      <div className="border-t border-white/10 mx-2" />

      {/* Sprites */}
      <button
        onClick={() => setSpritesOpen((o) => !o)}
        className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold text-white/40 uppercase tracking-wider hover:text-white/60 transition-colors w-full"
      >
        {spritesOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        Sprites
      </button>
      {spritesOpen && (
        <div className="px-2 pb-2 space-y-1.5">
          <div className="flex gap-1">
            <input
              value={spriteInput}
              onChange={(e) => setSpriteInput(e.target.value)}
              placeholder="Describe sprite…"
              className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded px-2 py-1 text-[10px] text-white/60 placeholder-white/20 focus:outline-none focus:border-emerald-400/40"
              onKeyDown={(e) => {
                if (e.key === "Enter" && spriteInput.trim() && !isGeneratingSprite) {
                  onGenerateSprite(spriteInput.trim());
                  setSpriteInput("");
                }
              }}
            />
            <button
              onClick={() => {
                if (spriteInput.trim() && !isGeneratingSprite) {
                  onGenerateSprite(spriteInput.trim());
                  setSpriteInput("");
                }
              }}
              disabled={!spriteInput.trim() || isGeneratingSprite}
              className="px-1.5 bg-emerald-400/10 rounded border border-emerald-400/20 text-emerald-400/60 hover:bg-emerald-400/20 disabled:opacity-30 transition-colors"
            >
              {isGeneratingSprite ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Wand2 className="w-3 h-3" />
              )}
            </button>
          </div>
          {sprites.length > 0 ? (
            <div className="grid grid-cols-3 gap-1 pt-0.5">
              {sprites.map((sprite, i) => (
                <button
                  key={i}
                  onClick={() => onAddSpriteToGame(sprite.url, sprite.description)}
                  className="relative group rounded overflow-hidden border border-white/10 hover:border-emerald-400/40 transition-colors"
                  title={`Click to add "${sprite.description}" to game`}
                >
                  <img
                    src={`/api/storage${sprite.url}`}
                    alt={sprite.description}
                    className="w-full aspect-square object-cover"
                  />
                  <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <Plus className="w-3 h-3 text-emerald-400" />
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-[9px] text-white/20 text-center pt-0.5">
              Describe a sprite and press Enter
            </p>
          )}
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

// ── Chat Panel ────────────────────────────────────────────────────────────────
interface ChatPanelProps {
  messages: ChatMessage[];
  isThinking: boolean;
  onSend: (text: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onReset: () => void;
  onCopyCode: () => void;
  onToggleFullscreen: () => void;
  canUndo: boolean;
  canRedo: boolean;
  canReset: boolean;
  isFullscreen: boolean;
  codeVersion: number;
}

function ChatPanel({
  messages,
  isThinking,
  onSend,
  onUndo,
  onRedo,
  onReset,
  onCopyCode,
  onToggleFullscreen,
  canUndo,
  canRedo,
  canReset,
  isFullscreen,
  codeVersion,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  // Auto-resize textarea as user types
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, [input]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || isThinking) return;
    setInput("");
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
    onSend(text);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleVoice = () => {
    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast({
        title: "Voice not supported",
        description: "Your browser doesn't support voice input.",
        variant: "destructive",
      });
      return;
    }
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = (e: any) => {
      const transcript = e.results[0]?.[0]?.transcript ?? "";
      setInput((prev) => (prev ? prev + " " + transcript : transcript));
      setIsListening(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  const charCount = input.length;
  const charMax = 2000;

  return (
    <div className="flex flex-col h-full bg-[#0f0f0f] min-h-0">
      {/* Panel header */}
      <div className="h-8 bg-[#111] border-b border-white/10 flex items-center px-3 gap-2 shrink-0">
        <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
        <span className="text-[11px] font-mono text-white/60 font-semibold">
          AI Game Assistant
        </span>
        <span className="ml-auto flex items-center gap-2 text-[10px] font-mono">
          {codeVersion > 0 && (
            <span className="text-white/25" title={`${codeVersion} AI edit${codeVersion === 1 ? "" : "s"} applied`}>
              v{codeVersion}
            </span>
          )}
          <span className="text-emerald-400/60">claude-sonnet</span>
        </span>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-white/10 bg-[#0d0d0d] shrink-0 flex-wrap">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo last AI change"
          className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-white/40 hover:text-white/70 hover:bg-white/5 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
        >
          <RotateCcw className="w-3 h-3" /> Undo
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo"
          className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-white/40 hover:text-white/70 hover:bg-white/5 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
        >
          <Redo2 className="w-3 h-3" /> Redo
        </button>
        <button
          onClick={onReset}
          disabled={!canReset}
          title="Reset to original generated version"
          className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-white/40 hover:text-white/70 hover:bg-white/5 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCcw className="w-3 h-3" /> Reset
        </button>
        <button
          onClick={onCopyCode}
          title="Copy current code to clipboard"
          className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
        >
          <Copy className="w-3 h-3" /> Copy
        </button>
        <button
          onClick={onToggleFullscreen}
          title={isFullscreen ? "Exit fullscreen preview" : "Fullscreen preview"}
          className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors ml-auto"
        >
          {isFullscreen ? (
            <Minimize2 className="w-3 h-3" />
          ) : (
            <Maximize2 className="w-3 h-3" />
          )}
          {isFullscreen ? "Exit" : "Fullscreen"}
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 min-h-0">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn("flex gap-2", msg.role === "user" && "flex-row-reverse")}
          >
            <div
              className={cn(
                "shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5",
                msg.role === "assistant" && "bg-emerald-400/20",
                msg.role === "user" && "bg-white/10",
                msg.role === "error" && "bg-red-900/40",
              )}
            >
              {msg.role === "assistant" && <Bot className="w-3 h-3 text-emerald-400" />}
              {msg.role === "user" && <User className="w-3 h-3 text-white/60" />}
              {msg.role === "error" && <AlertTriangle className="w-3 h-3 text-red-400" />}
            </div>

            <div
              className={cn(
                "max-w-[80%] rounded-lg px-2.5 py-1.5 text-[12px] leading-relaxed whitespace-pre-wrap",
                msg.role === "user" && "bg-emerald-400/10 text-white/80",
                msg.role === "assistant" && "bg-white/5 text-white/75",
                msg.role === "error" &&
                  "bg-red-900/30 text-red-300 border border-red-800/40",
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

      {/* Quick action chips */}
      <div className="px-3 pt-1.5 pb-1 flex flex-wrap gap-1 shrink-0 border-t border-white/5">
        {QUICK_CHIPS.map((chip) => (
          <button
            key={chip}
            onClick={() => {
              if (isThinking) return;
              onSend(chip);
            }}
            disabled={isThinking}
            className="px-2 py-0.5 rounded-full bg-white/5 text-[10px] text-white/40 hover:bg-emerald-400/15 hover:text-emerald-300 border border-white/10 hover:border-emerald-400/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Input area */}
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
            placeholder='Describe a change... try "add a double jump" or "make enemies faster"'
            rows={1}
            className="flex-1 bg-transparent text-[12px] text-white/75 placeholder:text-white/25 outline-none resize-none leading-5 overflow-hidden"
            style={{ minHeight: "20px", maxHeight: "120px" }}
            disabled={isThinking}
          />
          <div className="flex items-center gap-1.5 shrink-0 mb-0.5">
            <span
              className={cn(
                "text-[10px] font-mono tabular-nums",
                charCount > charMax * 0.9 ? "text-amber-400" : "text-white/20",
              )}
            >
              {charCount}
            </span>
            <button
              onClick={handleVoice}
              title={isListening ? "Stop recording" : "Voice input"}
              className={cn(
                "w-6 h-6 rounded-md flex items-center justify-center transition-colors",
                isListening
                  ? "bg-red-500/20 text-red-400 animate-pulse"
                  : "text-white/30 hover:text-white/60 hover:bg-white/5",
              )}
            >
              {isListening ? (
                <MicOff className="w-3 h-3" />
              ) : (
                <Mic className="w-3 h-3" />
              )}
            </button>
            <button
              onClick={handleSend}
              disabled={!input.trim() || isThinking}
              className="w-7 h-7 rounded-md flex items-center justify-center bg-emerald-500 hover:bg-emerald-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Send (Enter)"
            >
              <Send className="w-3.5 h-3.5 text-white" />
            </button>
          </div>
        </div>
        <p className="text-[10px] text-white/20 mt-1 ml-1">
          Enter to send · Shift+Enter for new line
        </p>
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

  const generateCoverMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/games/${id}/generate-cover`, { method: "POST" }).then(async (r) => {
        if (!r.ok) {
          const e = await r.json().catch(() => ({}));
          throw new Error((e as any).error || "Cover generation failed");
        }
        return r.json() as Promise<{ coverImageUrl: string }>;
      }),
    onSuccess: (data: { coverImageUrl: string }) => {
      setCoverImageUrl(data.coverImageUrl);
      toast({ title: "Cover generated!", description: "New cover art is ready." });
    },
    onError: (err: any) => {
      toast({
        title: "Cover generation failed",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const generateSpriteMutation = useMutation({
    mutationFn: (description: string) =>
      apiFetch(`/api/games/${id}/generate-sprite`, {
        method: "POST",
        body: JSON.stringify({ description }),
      }).then(async (r) => {
        if (!r.ok) {
          const e = await r.json().catch(() => ({}));
          throw new Error((e as any).error || "Sprite generation failed");
        }
        return r.json() as Promise<{ spriteUrl: string }>;
      }),
    onSuccess: (data: { spriteUrl: string }, description: string) => {
      setSprites((prev) => {
        const updated = [{ url: data.spriteUrl, description }, ...prev];
        // Persist updated sprite list to DB so they reload on next visit
        if (id) {
          const spritesJson = JSON.stringify(
            updated.map((s, i) => ({ name: `sprite_${i}`, url: s.url, description: s.description })),
          );
          apiFetch(`/api/games/${id}`, {
            method: "PATCH",
            body: JSON.stringify({ spritesJson }),
          }).catch(() => {/* non-critical */});
        }
        return updated;
      });
    },
    onError: (err: any) => {
      toast({
        title: "Sprite generation failed",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  // ── Editor state ──────────────────────────────────────────────────────────
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [codeVersion, setCodeVersion] = useState(0);
  const [previewCode, setPreviewCode] = useState("");
  const [iframeKey, setIframeKey] = useState(0);
  const [savedCode, setSavedCode] = useState("");
  const [savedTitle, setSavedTitle] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Undo / Redo history (refs for perf — counts trigger re-renders)
  const undoStack = useRef<string[]>([]);
  const redoStack = useRef<string[]>([]);
  const [undoCount, setUndoCount] = useState(0);
  const [redoCount, setRedoCount] = useState(0);

  // Original code — set once on first load, never changes
  const originalCode = useRef<string>("");

  // Chat state — seed with game plan from sessionStorage if present
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (!id) return [makeWelcome()];
    const plan = sessionStorage.getItem(`gamePlan_${id}`);
    if (plan) sessionStorage.removeItem(`gamePlan_${id}`);
    return [makeWelcome(plan)];
  });
  const [isThinking, setIsThinking] = useState(false);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [sprites, setSprites] = useState<Array<{ url: string; description: string }>>([]);

  const initializedForId = useRef<number | null>(null);

  // Initialise state from loaded game data (also resets history when switching games)
  useEffect(() => {
    if (game && initializedForId.current !== game.id) {
      initializedForId.current = game.id;
      // Use currentCode (AI-tracked live version) if available, otherwise fall back to gameCode
      const liveCode = game.currentCode ?? game.gameCode;
      setCode(liveCode);
      setTitle(game.title);
      setSavedCode(liveCode);
      setSavedTitle(game.title);
      setPreviewCode(liveCode);
      setIframeKey((k) => k + 1);
      setCodeVersion(game.codeVersion ?? 0);
      setCoverImageUrl(game.coverImageUrl ?? null);
      // Load auto-generated sprites from DB (exclude background sprite from the panel)
      try {
        const stored: Array<{ name: string; url: string; description: string }> = game.spritesJson
          ? JSON.parse(game.spritesJson)
          : [];
        setSprites(stored.filter((s) => s.name !== "bg").map(({ url, description }) => ({ url, description })));
      } catch {
        setSprites([]);
      }
      // Always anchor originalCode to this specific game's initial code
      originalCode.current = liveCode;
      // Clear history stacks — they belong to the previous game
      undoStack.current = [];
      redoStack.current = [];
      setUndoCount(0);
      setRedoCount(0);
    }
  }, [game]);

  const isDirty = code !== savedCode || title !== savedTitle;

  // Keep refs up-to-date for use inside intervals / callbacks
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

  // ── Undo ──────────────────────────────────────────────────────────────────
  const handleUndo = useCallback(() => {
    const prev = undoStack.current.pop();
    if (!prev) return;
    redoStack.current.push(codeRef.current);
    setUndoCount(undoStack.current.length);
    setRedoCount(redoStack.current.length);
    setCode(prev);
    setPreviewCode(prev);
    setIframeKey((k) => k + 1);
    if (id) doSave(prev, titleRef.current);
    setMessages((m) => [...m, newMsg("assistant", "↩ Reverted to the previous version.")]);
  }, [id, doSave]);

  // ── Redo ──────────────────────────────────────────────────────────────────
  const handleRedo = useCallback(() => {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push(codeRef.current);
    setUndoCount(undoStack.current.length);
    setRedoCount(redoStack.current.length);
    setCode(next);
    setPreviewCode(next);
    setIframeKey((k) => k + 1);
    if (id) doSave(next, titleRef.current);
    setMessages((m) => [...m, newMsg("assistant", "↪ Moved forward to the next version.")]);
  }, [id, doSave]);

  // ── Reset to original ─────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    const orig = originalCode.current;
    if (!orig || orig === codeRef.current) return;
    undoStack.current.push(codeRef.current);
    redoStack.current = [];
    setUndoCount(undoStack.current.length);
    setRedoCount(0);
    setCode(orig);
    setPreviewCode(orig);
    setIframeKey((k) => k + 1);
    if (id) doSave(orig, titleRef.current);
    setMessages((m) => [...m, newMsg("assistant", "🔄 Reset to the original generated version.")]);
  }, [id, doSave]);

  // ── Copy code ─────────────────────────────────────────────────────────────
  const handleCopyCode = useCallback(() => {
    navigator.clipboard.writeText(codeRef.current).then(() => {
      toast({ title: "Copied!", description: "Game code copied to clipboard." });
    });
  }, []);

  // ── AI chat send ──────────────────────────────────────────────────────────
  const handleChatSend = useCallback(
    async (text: string) => {
      if (!id || isThinking) return;

      setMessages((m) => [...m, newMsg("user", text)]);
      setIsThinking(true);

      // Save current code to undo stack before AI overwrites it
      undoStack.current.push(codeRef.current);
      // Any new edit clears the redo stack
      redoStack.current = [];
      if (undoStack.current.length > 20) undoStack.current.shift();
      setUndoCount(undoStack.current.length);
      setRedoCount(0);

      try {
        const data = await streamPost<{
          updatedCode: string;
          changeSummary?: string;
          codeVersion: number;
        }>(`/api/games/${id}/chat`, { message: text, currentCode: codeRef.current });

        setIsThinking(false);
        const updated = data.updatedCode;

        // Sanity check — auto-revert if response looks broken
        if (!updated || updated.length < 200 || !updated.trimStart().startsWith("<")) {
          undoStack.current.pop();
          setUndoCount(undoStack.current.length);
          setMessages((m) => [
            ...m,
            newMsg(
              "error",
              "⚠️ The AI returned invalid code. Your game is unchanged. Please try rephrasing your request.",
            ),
          ]);
          return;
        }

        // Apply the new code and reload the preview
        setCode(updated);
        setPreviewCode(updated);
        setIframeKey((k) => k + 1);

        // Track the new version number returned by the server
        if (data.codeVersion != null) setCodeVersion(data.codeVersion);

        // Auto-save the new version
        doSave(updated, titleRef.current);

        const summary = data.changeSummary;
        const successText = summary
          ? `✓ Done! ${summary}`
          : "✓ Applied your change and refreshed the preview.";

        setMessages((m) => [
          ...m,
          newMsg("assistant", successText, true /* undoable */),
        ]);
      } catch (err: any) {
        setIsThinking(false);
        // No change was made — pop the undo entry we optimistically added
        undoStack.current.pop();
        setUndoCount(undoStack.current.length);

        const detail =
          err?.error || err?.message || "The AI couldn't apply that change.";
        setMessages((m) => [
          ...m,
          newMsg(
            "error",
            `❌ ${detail}\n\nTry rephrasing, or be more specific about what you want to change.`,
          ),
        ]);
      }
    },
    [id, isThinking, doSave],
  );

  const handleAddSpriteToGame = useCallback(
    (spriteUrl: string, description: string) => {
      const fullUrl = `${window.location.origin}/api/storage${spriteUrl}`;
      handleChatSend(
        `Add this sprite to the game as a visual element. The sprite shows: ${description}. Load it using this URL: ${fullUrl}`,
      );
    },
    [handleChatSend],
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

  const canUndo = undoCount > 0;
  const canRedo = redoCount > 0;
  const canReset = !!originalCode.current && code !== originalCode.current;

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
                title="Unsaved changes — auto-saves every 30 s"
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

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">
        {/* Left sidebar */}
        <Sidebar
          coverImageUrl={coverImageUrl}
          isGeneratingCover={generateCoverMutation.isPending}
          onRegenerateCover={() => id != null && generateCoverMutation.mutate()}
          sprites={sprites}
          isGeneratingSprite={generateSpriteMutation.isPending}
          onGenerateSprite={(desc) => id != null && generateSpriteMutation.mutate(desc)}
          onAddSpriteToGame={handleAddSpriteToGame}
        />

        {/* Center + Right via horizontal resizable panels */}
        <ResizablePanelGroup direction="horizontal" className="flex-1 min-w-0">
          {/* Center: live game preview */}
          <ResizablePanel defaultSize={60} minSize={30}>
            <div className="relative h-full bg-black overflow-hidden">
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
          </ResizablePanel>

          <ResizableHandle className="w-1 bg-white/5 hover:bg-emerald-400/20 transition-colors cursor-col-resize" />

          {/* Right: vertically split code editor + chat */}
          <ResizablePanel defaultSize={40} minSize={25} maxSize={60}>
            <ResizablePanelGroup direction="vertical">
              {/* Top: syntax-highlighted code editor */}
              <ResizablePanel defaultSize={50} minSize={20}>
                <div className="flex flex-col h-full bg-[#0d0d0d]">
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
                  <div
                    className={cn(
                      "flex-1 overflow-auto min-h-0",
                      isThinking && "opacity-50 pointer-events-none",
                    )}
                  >
                    <CodeMirror
                      value={code}
                      onChange={(value) => setCode(value)}
                      extensions={[htmlLang()]}
                      theme={oneDark}
                      height="100%"
                      style={{ height: "100%", fontSize: "12px" }}
                      basicSetup={{
                        lineNumbers: true,
                        foldGutter: true,
                        autocompletion: true,
                      }}
                    />
                  </div>
                </div>
              </ResizablePanel>

              <ResizableHandle
                withHandle
                className="h-1.5 bg-white/5 hover:bg-emerald-400/20 transition-colors cursor-row-resize"
              />

              {/* Bottom: AI chat */}
              <ResizablePanel defaultSize={50} minSize={25}>
                <ChatPanel
                  messages={messages}
                  isThinking={isThinking}
                  onSend={handleChatSend}
                  onUndo={handleUndo}
                  onRedo={handleRedo}
                  onReset={handleReset}
                  onCopyCode={handleCopyCode}
                  onToggleFullscreen={() => setIsFullscreen((f) => !f)}
                  canUndo={canUndo}
                  canRedo={canRedo}
                  canReset={canReset}
                  isFullscreen={isFullscreen}
                  codeVersion={codeVersion}
                />
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* ── Fullscreen preview overlay ───────────────────────────────────────── */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          <div className="flex items-center justify-between px-4 py-2 bg-[#111] border-b border-white/10 shrink-0">
            <div className="flex items-center gap-2">
              <Gamepad2 className="w-4 h-4 text-emerald-400" />
              <span className="text-[12px] font-mono text-white/50">{title}</span>
            </div>
            <button
              onClick={() => setIsFullscreen(false)}
              className="p-1.5 rounded hover:bg-white/10 text-white/50 hover:text-white transition-colors"
              title="Exit fullscreen"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <iframe
            key={`fs-${iframeKey}`}
            srcDoc={previewCode}
            className="flex-1 border-none"
            sandbox="allow-scripts"
            title="Game Preview — Fullscreen"
          />
        </div>
      )}
    </div>
  );
}
