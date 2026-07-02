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
  Loader2,
  ArrowLeft,
  Save,
  Globe,
  Send,
  Bot,
  User,
  Sparkles,
  Volume2,
  VolumeX,
  RefreshCcw,
  Maximize2,
  Minimize2,
  X,
  ImageIcon,
  Wand2,
  Download,
  Layers,
  CheckCircle2,
  Settings2,
  Gamepad2,
  Brain,
  Share2,
  UserPlus,
  Copy,
  ChevronDown,
  Eye,
  EyeOff,
  Palette,
  Shield,
  Zap,
  RotateCcw,
  Redo2,
} from "lucide-react";
import ExportPanel from "@/components/ExportPanel";
import { toast } from "@/hooks/use-toast";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

// ── Chat message types ────────────────────────────────────────────────────────
type ChatRole = "user" | "assistant" | "error" | "thought";
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
      `Here's what I built:\n\n${gamePlan}\n\n---\nAsk me to change anything — try: "make it harder", "add power-ups", "change the colors", or "add a new enemy".`,
    );
  }
  return newMsg(
    "assistant",
    'Hi! I\'m your game AI. Describe a change and I\'ll update your game instantly.\n\nTry: "make the player faster", "add a double jump", "change the background", or "make the enemies harder".',
  );
}

const QUICK_CHIPS = [
  "Make it harder",
  "Add power up",
  "Add new enemy",
  "Change colors",
  "Add sound effects",
  "Fix any bugs",
];

// Thought steps that appear timed during AI editing
const THOUGHT_STEPS = [
  "Reading your game code…",
  "Planning the change…",
  "Writing updated code…",
];

// ── SpriteEntry type ──────────────────────────────────────────────────────────
interface SpriteEntry {
  name: string;
  url: string;
  description: string;
}

// ── AssetsSection helper ──────────────────────────────────────────────────────
interface AssetsSectionProps {
  title: string;
  items: SpriteEntry[];
  isRegenerating: boolean;
  onRegenerate: (desc: string, name: string) => void;
  onDownload: (url: string, filename: string) => void;
}

function AssetsSection({ title, items, isRegenerating, onRegenerate, onDownload }: AssetsSectionProps) {
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState("");

  if (items.length === 0) return null;

  return (
    <div className="border-b border-white/[0.06]">
      <div className="px-3 py-2 text-[10px] font-semibold text-white/30 uppercase tracking-widest">{title}</div>
      <div className="px-3 pb-3 grid grid-cols-3 gap-2">
        {items.map((sprite) => (
          <div key={sprite.name} className="space-y-1">
            <div className="relative group rounded-lg overflow-hidden border border-white/10 hover:border-emerald-400/30 transition-colors bg-black/40">
              <img
                src={`/api/storage${sprite.url}`}
                alt={sprite.description}
                className="w-full aspect-square object-cover"
              />
              <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-1.5 transition-opacity p-1">
                <button
                  onClick={() => { setEditingName(sprite.name); setEditPrompt(sprite.description); }}
                  className="w-full px-1.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/30 rounded text-[8px] text-emerald-300 transition-colors text-center"
                >
                  <Wand2 className="w-2.5 h-2.5 inline mr-0.5" />
                  Regen
                </button>
                <button
                  onClick={() => onDownload(`/api/storage${sprite.url}`, sprite.name)}
                  className="w-full px-1.5 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[8px] text-white/40 hover:text-white/60 transition-colors text-center"
                >
                  <Download className="w-2.5 h-2.5 inline mr-0.5" />
                  Save
                </button>
              </div>
            </div>
            <p className="text-[8px] text-white/25 truncate text-center leading-tight">{sprite.name}</p>
            {editingName === sprite.name && (
              <div className="col-span-3 space-y-1 p-2 bg-white/[0.03] rounded-lg border border-white/10">
                <textarea
                  value={editPrompt}
                  onChange={(e) => setEditPrompt(e.target.value)}
                  rows={2}
                  className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-[9px] text-white/60 placeholder-white/20 focus:outline-none focus:border-emerald-400/40 resize-none"
                />
                <div className="flex gap-1">
                  <button
                    onClick={() => { onRegenerate(editPrompt, sprite.name); setEditingName(null); }}
                    disabled={isRegenerating || !editPrompt.trim()}
                    className="flex-1 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/30 rounded text-[9px] text-emerald-400 disabled:opacity-40 transition-colors"
                  >
                    {isRegenerating ? <Loader2 className="w-2.5 h-2.5 animate-spin mx-auto" /> : "Regenerate"}
                  </button>
                  <button
                    onClick={() => setEditingName(null)}
                    className="px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[9px] text-white/40 transition-colors"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Left Panel (Chat / Assets / Settings) ────────────────────────────────────
type LeftTab = "chat" | "assets" | "settings";

interface LeftPanelProps {
  // Chat
  messages: ChatMessage[];
  isThinking: boolean;
  onSend: (text: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onReset: () => void;
  canUndo: boolean;
  canRedo: boolean;
  canReset: boolean;
  codeVersion: number;
  // Assets
  sprites: SpriteEntry[];
  coverImageUrl: string | null;
  isGeneratingSprites: boolean;
  spriteGenStatus: string | null;
  isGeneratingCover: boolean;
  generationStatus?: string | null;
  onRegenerateCover: () => void;
  onRegenerateSprite: (desc: string, name: string) => void;
  onDownloadAsset: (url: string, filename: string) => void;
  onRetryGeneration?: () => void;
  isGeneratingCustomSprite: boolean;
  onGenerateCustomSprite: (desc: string) => void;
  // Settings
  title: string;
  onTitleChange: (t: string) => void;
  genre: string;
  gameStatus: string;
  onSave: () => void;
  onPublish: () => void;
  isSaving: boolean;
  isDirty: boolean;
  isPublishing: boolean;
  onCopyCode: () => void;
  onExportHtml: () => void;
  // Active tab
  activeTab: LeftTab;
  onTabChange: (t: LeftTab) => void;
}

function LeftPanel({
  messages, isThinking, onSend, onUndo, onRedo, onReset,
  canUndo, canRedo, canReset, codeVersion,
  sprites, coverImageUrl, isGeneratingSprites, spriteGenStatus,
  isGeneratingCover, generationStatus,
  onRegenerateCover, onRegenerateSprite, onDownloadAsset, onRetryGeneration,
  isGeneratingCustomSprite, onGenerateCustomSprite,
  title, onTitleChange, genre, gameStatus, onSave, onPublish,
  isSaving, isDirty, isPublishing, onCopyCode, onExportHtml,
  activeTab, onTabChange,
}: LeftPanelProps) {
  const [input, setInput] = useState("");
  const [spriteInput, setSpriteInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

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
    onSend(text);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const bgSprite = sprites.filter((s) => s.name === "bg");
  const playerSprites = sprites.filter((s) => s.name === "player");
  const enemySprites = sprites.filter((s) => s.name.startsWith("enemy"));
  const itemSprites = sprites.filter((s) => s.name.startsWith("item"));
  const hasAnySprites = sprites.length > 0;

  return (
    <div className="flex flex-col h-full bg-[#111] border-r border-white/[0.07]" style={{ width: "30%", minWidth: 260, maxWidth: 420 }}>
      {/* ── Logo + tabs ─────────────────────────────────────────────────── */}
      <div className="shrink-0 px-4 pt-4 pb-0">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0">
            <Gamepad2 className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <span className="text-[13px] font-semibold text-white/80 tracking-tight">GameForge AI</span>
          {isDirty && (
            <span className="ml-auto text-[10px] text-amber-400/60 font-mono">unsaved</span>
          )}
        </div>

        {/* Pill tabs */}
        <div className="flex gap-0.5 bg-white/[0.04] rounded-xl p-1" role="tablist" aria-label="Editor panels">
          {(["chat", "assets", "settings"] as LeftTab[]).map((tab) => (
            <button
              key={tab}
              role="tab"
              aria-selected={activeTab === tab}
              onClick={() => onTabChange(tab)}
              className={cn(
                "flex-1 py-1.5 rounded-lg text-[11px] font-medium capitalize transition-all duration-150",
                activeTab === tab
                  ? "bg-white/10 text-white shadow-sm"
                  : "text-white/35 hover:text-white/60",
              )}
            >
              {tab}
              {tab === "assets" && isGeneratingSprites && (
                <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse align-middle" aria-label="generating" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Chat tab ────────────────────────────────────────────────────── */}
      {activeTab === "chat" && (
        <div className="flex flex-col flex-1 min-h-0 pt-3">
          {/* Message thread */}
          <div className="flex-1 overflow-y-auto px-3 space-y-2 pb-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            {messages.map((msg) => (
              <div key={msg.id}>
                {msg.role === "thought" ? (
                  // AI thought stream bubble
                  <div className="flex items-start gap-2 py-0.5">
                    <div className="w-4 h-4 rounded-full bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center shrink-0 mt-0.5">
                      <Brain className="w-2.5 h-2.5 text-emerald-400/60" />
                    </div>
                    <p className="text-[10px] text-white/30 italic font-mono leading-relaxed pt-0.5">{msg.text}</p>
                  </div>
                ) : msg.role === "user" ? (
                  <div className="flex justify-end">
                    <div className="max-w-[85%] px-3 py-2 rounded-2xl rounded-tr-sm bg-emerald-500/20 border border-emerald-400/20">
                      <p className="text-[12px] text-white/90 leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                    </div>
                  </div>
                ) : msg.role === "error" ? (
                  <div className="flex items-start gap-2">
                    <div className="w-6 h-6 rounded-full bg-red-500/15 border border-red-400/20 flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="w-3 h-3 text-red-400/70" />
                    </div>
                    <div className="max-w-[88%] px-3 py-2 rounded-2xl rounded-tl-sm bg-red-900/20 border border-red-400/20">
                      <p className="text-[12px] text-red-300/80 leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                    </div>
                  </div>
                ) : (
                  // assistant
                  <div className="flex items-start gap-2">
                    <div className="w-6 h-6 rounded-full bg-emerald-400/15 border border-emerald-400/20 flex items-center justify-center shrink-0 mt-0.5">
                      <Sparkles className="w-3 h-3 text-emerald-400/80" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="max-w-[88%] px-3 py-2 rounded-2xl rounded-tl-sm bg-white/[0.05] border border-white/[0.08]">
                        <p className="text-[12px] text-white/80 leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                      </div>
                      {msg.undoable && canUndo && (
                        <button
                          onClick={onUndo}
                          className="mt-1 ml-1 text-[10px] text-white/25 hover:text-amber-400/70 transition-colors flex items-center gap-1"
                        >
                          <RotateCcw className="w-2.5 h-2.5" />
                          Undo this change
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Live typing indicator */}
            {isThinking && (
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 rounded-full bg-emerald-400/15 border border-emerald-400/20 flex items-center justify-center shrink-0">
                  <Sparkles className="w-3 h-3 text-emerald-400/80 animate-pulse" />
                </div>
                <div className="px-3 py-2 rounded-2xl rounded-tl-sm bg-white/[0.05] border border-white/[0.08]">
                  <div className="flex gap-1 items-center h-4">
                    <span className="w-1.5 h-1.5 bg-emerald-400/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 bg-emerald-400/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 bg-emerald-400/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick action chips */}
          <div className="px-3 pb-2 flex flex-wrap gap-1">
            {QUICK_CHIPS.map((chip) => (
              <button
                key={chip}
                onClick={() => !isThinking && onSend(chip)}
                disabled={isThinking}
                className="px-2.5 py-1 rounded-full bg-white/[0.04] hover:bg-emerald-400/10 border border-white/[0.08] hover:border-emerald-400/25 text-[10px] text-white/40 hover:text-emerald-300 transition-all disabled:opacity-30"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* History actions */}
          {(canUndo || canRedo || canReset) && (
            <div className="px-3 pb-2 flex gap-1">
              <button
                onClick={onUndo}
                disabled={!canUndo}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-[10px] text-white/30 hover:text-white/60 disabled:opacity-20 transition-colors"
                title="Undo last change"
              >
                <RotateCcw className="w-3 h-3" /> Undo
              </button>
              <button
                onClick={onRedo}
                disabled={!canRedo}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-[10px] text-white/30 hover:text-white/60 disabled:opacity-20 transition-colors"
                title="Redo"
              >
                <Redo2 className="w-3 h-3" /> Redo
              </button>
              {canReset && (
                <button
                  onClick={onReset}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/[0.04] hover:bg-amber-400/10 border border-white/[0.08] hover:border-amber-400/20 text-[10px] text-white/30 hover:text-amber-400/70 transition-colors"
                  title="Reset to original"
                >
                  <RefreshCcw className="w-3 h-3" /> Reset
                </button>
              )}
            </div>
          )}

          {/* Input area */}
          <div className="px-3 pb-3 shrink-0">
            <div className={cn(
              "flex items-end gap-2 rounded-2xl border px-3 py-2 transition-colors",
              isThinking
                ? "bg-white/[0.02] border-white/[0.06] opacity-60"
                : "bg-white/[0.05] border-white/[0.10] focus-within:border-emerald-400/40",
            )}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                readOnly={isThinking}
                placeholder={isThinking ? "AI is working…" : "Ask me to change anything…"}
                rows={1}
                className="flex-1 bg-transparent text-[13px] text-white/80 placeholder-white/20 resize-none focus:outline-none leading-relaxed min-h-[20px] max-h-[120px]"
                style={{ height: "auto" }}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isThinking}
                className="w-7 h-7 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-white/10 flex items-center justify-center transition-colors shrink-0 mb-0.5"
              >
                {isThinking
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin text-white/40" />
                  : <Send className="w-3.5 h-3.5 text-white" />
                }
              </button>
            </div>
          </div>

          {/* Footer: model + version */}
          <div className="px-4 pb-3 flex items-center justify-between shrink-0 border-t border-white/[0.06] pt-2">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-[10px] text-white/25 font-mono">claude-sonnet-4</span>
            </div>
            <span className="text-[10px] text-white/20 font-mono">v{codeVersion}</span>
          </div>
        </div>
      )}

      {/* ── Assets tab ──────────────────────────────────────────────────── */}
      {activeTab === "assets" && (
        <div className="flex-1 min-h-0 flex flex-col pt-3 overflow-hidden">
          {/* Generation progress */}
          {isGeneratingSprites && (
            <div className="mx-3 mb-3 p-3 bg-emerald-900/20 border border-emerald-400/20 rounded-xl">
              <div className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400 shrink-0" />
                <span className="text-[11px] text-emerald-300 truncate">
                  {spriteGenStatus ?? "Generating sprites…"}
                </span>
              </div>
              <p className="text-[10px] text-white/25 mt-1.5 ml-5.5">
                Sprites appear live as they finish
              </p>
            </div>
          )}

          {/* Error state */}
          {!isGeneratingSprites && generationStatus === "sprites_error" && (
            <div className="mx-3 mb-3 p-3 bg-red-900/20 border border-red-400/20 rounded-xl">
              <p className="text-[11px] text-red-300 mb-2">Sprite generation failed</p>
              {onRetryGeneration && (
                <button
                  onClick={onRetryGeneration}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-400/30 rounded-lg text-[11px] text-red-300 transition-colors"
                >
                  <RefreshCcw className="w-3 h-3" />
                  Retry Generation
                </button>
              )}
            </div>
          )}

          {!hasAnySprites && !isGeneratingSprites && generationStatus !== "sprites_error" && (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center flex-1">
              <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-3">
                <Layers className="w-5 h-5 text-white/15" />
              </div>
              <p className="text-[12px] text-white/30 font-medium">No sprites yet</p>
              <p className="text-[11px] text-white/20 mt-1">Generate sprites from the Chat tab</p>
            </div>
          )}

          <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            <AssetsSection
              title="Background"
              items={bgSprite}
              isRegenerating={false}
              onRegenerate={onRegenerateSprite}
              onDownload={onDownloadAsset}
            />
            <AssetsSection
              title="Player"
              items={playerSprites}
              isRegenerating={false}
              onRegenerate={onRegenerateSprite}
              onDownload={onDownloadAsset}
            />
            <AssetsSection
              title="Enemies"
              items={enemySprites}
              isRegenerating={false}
              onRegenerate={onRegenerateSprite}
              onDownload={onDownloadAsset}
            />
            <AssetsSection
              title="Items & Collectibles"
              items={itemSprites}
              isRegenerating={false}
              onRegenerate={onRegenerateSprite}
              onDownload={onDownloadAsset}
            />

            {/* Game cover */}
            {(coverImageUrl || isGeneratingCover) && (
              <div className="border-b border-white/[0.06]">
                <div className="px-3 py-2 text-[10px] font-semibold text-white/30 uppercase tracking-widest">Game Cover</div>
                <div className="px-3 pb-3">
                  <div className="relative group rounded-xl overflow-hidden border border-white/10">
                    {coverImageUrl && (
                      <img
                        src={`/api/storage${coverImageUrl}`}
                        alt="Cover"
                        className="w-full h-28 object-cover"
                      />
                    )}
                    {isGeneratingCover && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                        <Loader2 className="w-5 h-5 animate-spin text-white" />
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={onRegenerateCover}
                      disabled={isGeneratingCover}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/[0.04] hover:bg-emerald-400/10 border border-white/[0.08] hover:border-emerald-400/25 rounded-lg text-[10px] text-white/40 hover:text-emerald-300 disabled:opacity-40 transition-colors"
                    >
                      <RefreshCcw className="w-3 h-3" />
                      Regenerate
                    </button>
                    {coverImageUrl && (
                      <button
                        onClick={() => onDownloadAsset(`/api/storage${coverImageUrl}`, "cover")}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] rounded-lg text-[10px] text-white/40 hover:text-white/60 transition-colors"
                      >
                        <Download className="w-3 h-3" />
                        Download
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Custom sprite generation */}
            <div className="px-3 py-4">
              <p className="text-[10px] text-white/30 uppercase tracking-widest font-semibold mb-2">Custom Sprite</p>
              <div className="flex gap-2">
                <input
                  value={spriteInput}
                  onChange={(e) => setSpriteInput(e.target.value)}
                  placeholder="Describe a sprite…"
                  className="flex-1 min-w-0 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-[11px] text-white/60 placeholder-white/20 focus:outline-none focus:border-emerald-400/40"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && spriteInput.trim() && !isGeneratingCustomSprite) {
                      onGenerateCustomSprite(spriteInput.trim());
                      setSpriteInput("");
                    }
                  }}
                />
                <button
                  onClick={() => {
                    if (spriteInput.trim() && !isGeneratingCustomSprite) {
                      onGenerateCustomSprite(spriteInput.trim());
                      setSpriteInput("");
                    }
                  }}
                  disabled={!spriteInput.trim() || isGeneratingCustomSprite}
                  className="px-3 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/25 rounded-xl text-emerald-400 disabled:opacity-30 transition-colors"
                >
                  {isGeneratingCustomSprite ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Settings tab ────────────────────────────────────────────────── */}
      {activeTab === "settings" && (
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 px-4 py-4 space-y-5">
          {/* Game info */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-white/30 uppercase tracking-widest">Game Title</label>
            <input
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              className="w-full bg-white/[0.05] border border-white/[0.10] focus:border-emerald-400/40 rounded-xl px-3 py-2.5 text-[13px] text-white/80 placeholder-white/20 focus:outline-none transition-colors"
              placeholder="Enter game title…"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-white/30 uppercase tracking-widest">Genre</label>
            <div className="flex items-center gap-2 px-3 py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-xl">
              <Gamepad2 className="w-3.5 h-3.5 text-emerald-400/60" />
              <span className="text-[13px] text-white/50">{genre || "—"}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-white/30 uppercase tracking-widest">Visibility</label>
            <div className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl border",
              gameStatus === "published"
                ? "bg-emerald-500/10 border-emerald-400/25"
                : "bg-white/[0.03] border-white/[0.08]",
            )}>
              {gameStatus === "published"
                ? <Eye className="w-3.5 h-3.5 text-emerald-400" />
                : <EyeOff className="w-3.5 h-3.5 text-white/30" />
              }
              <span className={cn("text-[13px] font-medium flex-1", gameStatus === "published" ? "text-emerald-300" : "text-white/40")}>
                {gameStatus === "published" ? "Public" : "Draft"}
              </span>
              {gameStatus === "draft" && (
                <button
                  onClick={onPublish}
                  disabled={isPublishing}
                  className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/30 rounded-lg text-[10px] text-emerald-400 disabled:opacity-40 transition-colors"
                >
                  {isPublishing ? <Loader2 className="w-3 h-3 animate-spin" /> : "Publish"}
                </button>
              )}
            </div>
          </div>

          {/* Save */}
          <button
            onClick={onSave}
            disabled={isSaving || !isDirty}
            className={cn(
              "w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border text-[13px] font-medium transition-all",
              isDirty
                ? "bg-amber-400/10 border-amber-400/30 text-amber-300 hover:bg-amber-400/20"
                : "bg-white/[0.03] border-white/[0.08] text-white/20",
            )}
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isSaving ? "Saving…" : isDirty ? "Save Changes" : "Saved"}
          </button>

          {/* Export */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-white/30 uppercase tracking-widest">Export</label>
            <div className="space-y-2">
              <button
                onClick={onExportHtml}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.08] rounded-xl text-[12px] text-white/50 hover:text-white/70 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Download HTML file
              </button>
              <button
                onClick={onCopyCode}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.08] rounded-xl text-[12px] text-white/50 hover:text-white/70 transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                Copy source code
              </button>
            </div>
          </div>

          {/* AI settings */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-white/30 uppercase tracking-widest">AI Quick Actions</label>
            <div className="space-y-1">
              {[
                { icon: Palette, label: "Change Theme & Colors" },
                { icon: Shield, label: "Adjust Difficulty" },
                { icon: Zap, label: "Tweak Physics" },
                { icon: Settings2, label: "Remap Controls" },
              ].map(({ icon: Icon, label }) => (
                <button
                  key={label}
                  className="w-full flex items-center gap-2.5 px-3 py-2 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] rounded-xl text-[11px] text-white/35 hover:text-white/60 transition-colors"
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
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
      toast({ title: "Cover generation failed", description: err?.message || "Please try again.", variant: "destructive" });
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
      const newSprite: SpriteEntry = { name: `custom_${Date.now()}`, url: data.spriteUrl, description };
      setSprites((prev) => {
        const updated = [newSprite, ...prev];
        if (id) {
          const spritesJson = JSON.stringify(updated.map((s) => ({ name: s.name, url: s.url, description: s.description })));
          apiFetch(`/api/games/${id}`, { method: "PATCH", body: JSON.stringify({ spritesJson }) }).catch(() => {});
        }
        return updated;
      });
    },
    onError: (err: any) => {
      toast({ title: "Sprite generation failed", description: err?.message || "Please try again.", variant: "destructive" });
    },
  });

  // ── Editor state ────────────────────────────────────────────────────────────
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [codeVersion, setCodeVersion] = useState(0);
  const [previewCode, setPreviewCode] = useState("");
  const [iframeKey, setIframeKey] = useState(0);
  const [savedCode, setSavedCode] = useState("");
  const [savedTitle, setSavedTitle] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [leftTab, setLeftTab] = useState<LeftTab>("chat");
  const [showExportPanel, setShowExportPanel] = useState(false);

  // Background sprite generation state
  const [isGeneratingSprites, setIsGeneratingSprites] = useState(false);
  const [spriteGenStatus, setSpriteGenStatus] = useState<string | null>(null);
  const spriteGenStartedForId = useRef<number | null>(null);

  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Undo / Redo
  const undoStack = useRef<string[]>([]);
  const redoStack = useRef<string[]>([]);
  const [undoCount, setUndoCount] = useState(0);
  const [redoCount, setRedoCount] = useState(0);
  const originalCode = useRef<string>("");

  // Thought-step timer refs — cleared on unmount to prevent setState on dead component
  const thoughtTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => thoughtTimers.current.forEach(clearTimeout), []);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (!id) return [makeWelcome()];
    const plan = sessionStorage.getItem(`gamePlan_${id}`);
    if (plan) sessionStorage.removeItem(`gamePlan_${id}`);
    return [makeWelcome(plan)];
  });
  const [isThinking, setIsThinking] = useState(false);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [sprites, setSprites] = useState<SpriteEntry[]>([]);

  const initializedForId = useRef<number | null>(null);

  useEffect(() => {
    if (game && initializedForId.current !== game.id) {
      initializedForId.current = game.id;
      const liveCode = game.currentCode ?? game.gameCode;
      setCode(liveCode);
      setTitle(game.title);
      setSavedCode(liveCode);
      setSavedTitle(game.title);
      setPreviewCode(liveCode);
      setIframeKey((k) => k + 1);
      setCodeVersion(game.codeVersion ?? 0);
      setCoverImageUrl(game.coverImageUrl ?? null);
      try {
        const stored: Array<{ name: string; url: string; description: string }> = game.spritesJson
          ? JSON.parse(game.spritesJson)
          : [];
        setSprites(stored.map(({ name, url, description }) => ({ name: name ?? "sprite", url, description })));
      } catch { setSprites([]); }
      originalCode.current = liveCode;
      undoStack.current = [];
      redoStack.current = [];
      setUndoCount(0);
      setRedoCount(0);
    }
  }, [game]);

  const isDirty = code !== savedCode || title !== savedTitle;
  const codeRef = useRef(code);
  const titleRef = useRef(title);
  codeRef.current = code;
  titleRef.current = title;
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  // ── Save ────────────────────────────────────────────────────────────────────
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
            toast({ title: "Auto-save failed", description: "Could not save changes.", variant: "destructive" });
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
      if (isDirtyRef.current && id && !isSaving) doSave(codeRef.current, titleRef.current);
    }, 30_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleSave = () => {
    if (!isDirty) return;
    doSave(code, title);
    toast({ title: "Saved", description: "Draft saved." });
  };

  const handleBack = () => {
    if (isDirtyRef.current && id && !isSaving) doSave(codeRef.current, titleRef.current);
    setLocation("/my-games");
  };

  const handlePublish = () => {
    if (!id) return;
    const doPublish = () => {
      publishGame.mutate(
        { id },
        {
          onSuccess: (data) => {
            toast({ title: "Game published!", description: `Your game is now live at /play/${data.slug}` });
            queryClient.setQueryData(getGetGameQueryKey(id), data);
          },
          onError: (err: any) => {
            toast({ title: "Publish failed", description: err?.error || "Could not publish game.", variant: "destructive" });
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
            setSavedCode(code); setSavedTitle(title);
            queryClient.setQueryData(getGetGameQueryKey(id), data);
            doPublish();
          },
          onError: () => {
            toast({ title: "Save failed before publish", description: "Could not save changes.", variant: "destructive" });
          },
          onSettled: () => setIsSaving(false),
        },
      );
    } else {
      doPublish();
    }
  };

  const handleUndo = useCallback(() => {
    const prev = undoStack.current.pop();
    if (!prev) return;
    redoStack.current.push(codeRef.current);
    setUndoCount(undoStack.current.length);
    setRedoCount(redoStack.current.length);
    setCode(prev); setPreviewCode(prev);
    setIframeKey((k) => k + 1);
    if (id) doSave(prev, titleRef.current);
    setMessages((m) => [...m, newMsg("assistant", "↩ Reverted to the previous version.")]);
  }, [id, doSave]);

  const handleRedo = useCallback(() => {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push(codeRef.current);
    setUndoCount(undoStack.current.length);
    setRedoCount(redoStack.current.length);
    setCode(next); setPreviewCode(next);
    setIframeKey((k) => k + 1);
    if (id) doSave(next, titleRef.current);
    setMessages((m) => [...m, newMsg("assistant", "↪ Moved forward to the next version.")]);
  }, [id, doSave]);

  const handleReset = useCallback(() => {
    const orig = originalCode.current;
    if (!orig || orig === codeRef.current) return;
    undoStack.current.push(codeRef.current);
    redoStack.current = [];
    setUndoCount(undoStack.current.length);
    setRedoCount(0);
    setCode(orig); setPreviewCode(orig);
    setIframeKey((k) => k + 1);
    if (id) doSave(orig, titleRef.current);
    setMessages((m) => [...m, newMsg("assistant", "🔄 Reset to the original generated version.")]);
  }, [id, doSave]);

  const handleCopyCode = useCallback(() => {
    navigator.clipboard.writeText(codeRef.current).then(() => {
      toast({ title: "Copied!", description: "Game code copied to clipboard." });
    });
  }, []);

  const handleExportHtml = useCallback(() => {
    const blob = new Blob([codeRef.current], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${titleRef.current || "game"}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  // ── AI chat send ────────────────────────────────────────────────────────────
  const handleChatSend = useCallback(
    async (text: string) => {
      if (!id || isThinking) return;
      setMessages((m) => [...m, newMsg("user", text)]);
      setIsThinking(true);

      // Save current code to undo stack
      undoStack.current.push(codeRef.current);
      redoStack.current = [];
      if (undoStack.current.length > 20) undoStack.current.shift();
      setUndoCount(undoStack.current.length);
      setRedoCount(0);

      // Emit timed thought-step bubbles
      thoughtTimers.current.forEach(clearTimeout);
      thoughtTimers.current = THOUGHT_STEPS.map((step, i) => {
        return setTimeout(() => {
          setMessages((m) => [...m, newMsg("thought", step)]);
        }, i * 1800);
      });

      try {
        const data = await streamPost<{
          updatedCode: string;
          changeSummary?: string;
          codeVersion: number;
        }>(`/api/games/${id}/chat`, { message: text, currentCode: codeRef.current });

        // Clear remaining timers
        thoughtTimers.current.forEach(clearTimeout);
        setIsThinking(false);
        const updated = data.updatedCode;

        if (!updated || updated.length < 200 || !updated.trimStart().startsWith("<")) {
          undoStack.current.pop();
          setUndoCount(undoStack.current.length);
          setMessages((m) => [...m, newMsg("error", "⚠️ The AI returned invalid code. Your game is unchanged. Please try rephrasing your request.")]);
          return;
        }

        setCode(updated);
        setPreviewCode(updated);
        setIframeKey((k) => k + 1);
        if (data.codeVersion != null) setCodeVersion(data.codeVersion);
        doSave(updated, titleRef.current);

        const summary = data.changeSummary;
        setMessages((m) => [...m, newMsg("assistant", summary ? `✓ Done! ${summary}` : "✓ Applied your change and refreshed the preview.", true)]);
      } catch (err: any) {
        thoughtTimers.current.forEach(clearTimeout);
        setIsThinking(false);
        undoStack.current.pop();
        setUndoCount(undoStack.current.length);
        const detail = err?.error || err?.message || "The AI couldn't apply that change.";
        setMessages((m) => [...m, newMsg("error", `❌ ${detail}\n\nTry rephrasing, or be more specific about what you want to change.`)]);
      }
    },
    [id, isThinking, doSave],
  );

  // ── Regenerate sprite ───────────────────────────────────────────────────────
  const handleRegenSprite = useCallback(
    async (description: string, name: string) => {
      if (!id) return;
      try {
        const r = await apiFetch(`/api/games/${id}/generate-sprite`, {
          method: "POST",
          body: JSON.stringify({ description }),
        });
        if (!r.ok) {
          const e = await r.json().catch(() => ({}));
          throw new Error((e as any).error || "Sprite generation failed");
        }
        const data: { spriteUrl: string } = await r.json();
        setSprites((prev) => {
          const updated = prev.map((s) => s.name === name ? { ...s, url: data.spriteUrl, description } : s);
          if (!updated.find((s) => s.name === name)) updated.unshift({ name, url: data.spriteUrl, description });
          const spritesJson = JSON.stringify(updated.map((s) => ({ name: s.name, url: s.url, description: s.description })));
          apiFetch(`/api/games/${id}`, { method: "PATCH", body: JSON.stringify({ spritesJson }) }).catch(() => {});
          return updated;
        });
        const url = `${window.location.origin}/api/storage${data.spriteUrl}`;
        iframeRef.current?.contentWindow?.postMessage({ type: "spriteReady", name, url }, "*");
        toast({ title: "Sprite regenerated!", description: `${name} updated.` });
      } catch (err: any) {
        toast({ title: "Regen failed", description: err?.message || "Please try again.", variant: "destructive" });
      }
    },
    [id],
  );

  const handleDownloadAsset = useCallback((url: string, filename: string) => {
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.target = "_blank";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }, []);

  // ── Background sprite generation ────────────────────────────────────────────
  const handleSpriteGeneration = useCallback(async () => {
    if (!id || isGeneratingSprites) return;
    setIsGeneratingSprites(true);
    setSpriteGenStatus("Starting sprite generation…");
    try {
      await streamPost<{ sprites: Array<{ name: string; url: string; objectPath: string; description: string }> }>(
        `/api/games/${id}/generate-sprites`,
        {},
        (msg) => setSpriteGenStatus(msg),
        undefined,
        (event) => {
          if (event.type === "sprite_ready") {
            const s = event as { name: string; url: string; objectPath: string; description: string };
            iframeRef.current?.contentWindow?.postMessage({ type: "spriteReady", name: s.name, url: s.url }, "*");
            setSprites((prev) => {
              const updated = [...prev.filter((p) => p.name !== s.name), { name: s.name, url: s.objectPath, description: s.description }];
              return updated;
            });
          }
        },
      );
      queryClient.invalidateQueries({ queryKey: getGetGameQueryKey(id) });
      setSpriteGenStatus(null);
      setLeftTab("assets");
    } catch (err: any) {
      setSpriteGenStatus(null);
      toast({
        title: "Sprite generation failed",
        description: err?.error || err?.message || "Could not generate sprites. You can retry from the Assets panel.",
        variant: "destructive",
      });
      if (id) queryClient.invalidateQueries({ queryKey: getGetGameQueryKey(id) });
    } finally {
      setIsGeneratingSprites(false);
    }
  }, [id, isGeneratingSprites, queryClient]);

  useEffect(() => {
    if (!game || !game.id) return;
    if (game.generationStatus !== "sprites_pending") return;
    if (spriteGenStartedForId.current === game.id) return;
    if (isGeneratingSprites) return;
    spriteGenStartedForId.current = game.id;
    handleSpriteGeneration();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.id, game?.generationStatus]);

  // ── Loading / error states ──────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex-1 flex justify-center items-center h-screen bg-[#0a0a0a]">
        <Loader2 className="w-7 h-7 text-emerald-400 animate-spin" />
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="flex-1 flex justify-center items-center h-screen text-red-400 text-sm">
        Error loading game
      </div>
    );
  }

  const canUndo = undoCount > 0;
  const canRedo = redoCount > 0;
  const canReset = !!originalCode.current && code !== originalCode.current;

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-[#0a0a0a] text-white">

      {/* ── Left panel (30%) — tabbed AI panel ───────────────────────────────── */}
      <LeftPanel
        // Chat
        messages={messages}
        isThinking={isThinking}
        onSend={handleChatSend}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onReset={handleReset}
        canUndo={canUndo}
        canRedo={canRedo}
        canReset={canReset}
        codeVersion={codeVersion}
        // Assets
        sprites={sprites}
        coverImageUrl={coverImageUrl}
        isGeneratingSprites={isGeneratingSprites}
        spriteGenStatus={spriteGenStatus}
        isGeneratingCover={generateCoverMutation.isPending}
        generationStatus={game?.generationStatus}
        onRegenerateCover={() => id != null && generateCoverMutation.mutate()}
        onRegenerateSprite={handleRegenSprite}
        onDownloadAsset={handleDownloadAsset}
        onRetryGeneration={() => { spriteGenStartedForId.current = null; handleSpriteGeneration(); }}
        isGeneratingCustomSprite={generateSpriteMutation.isPending}
        onGenerateCustomSprite={(desc) => id != null && generateSpriteMutation.mutate(desc)}
        // Settings
        title={title}
        onTitleChange={setTitle}
        genre={game.genre ?? ""}
        gameStatus={game.status}
        onSave={handleSave}
        onPublish={handlePublish}
        isSaving={isSaving}
        isDirty={isDirty}
        isPublishing={publishGame.isPending}
        onCopyCode={handleCopyCode}
        onExportHtml={handleExportHtml}
        // Tab
        activeTab={leftTab}
        onTabChange={setLeftTab}
      />

      {/* ── Right panel (70%) — game preview ─────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* Top bar */}
        <div className="h-12 shrink-0 flex items-center gap-3 px-4 bg-[#0f0f0f] border-b border-white/[0.07]">
          {/* Back */}
          <button
            onClick={handleBack}
            className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/30 hover:text-white/60 transition-colors shrink-0"
            aria-label="Back to my games"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          {/* Title + status */}
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-[13px] font-semibold text-white/80 truncate max-w-48">{title || "Untitled"}</span>
            <span className={cn(
              "shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide",
              game.status === "published"
                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-400/25"
                : "bg-white/[0.05] text-white/25 border border-white/[0.08]",
            )}>
              {game.status === "published" ? "Live" : "Draft"}
            </span>
            {isDirty && <span className="w-1.5 h-1.5 rounded-full bg-amber-400/70 shrink-0" title="Unsaved changes" />}
            {isSaving && <Loader2 className="w-3 h-3 text-white/30 animate-spin shrink-0" />}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Icon controls */}
          <div className="flex items-center gap-0.5" role="toolbar" aria-label="Preview controls">
            <button
              onClick={() => setIsMuted((m) => !m)}
              className="w-8 h-8 rounded-lg hover:bg-white/[0.06] flex items-center justify-center text-white/30 hover:text-white/60 transition-colors"
              aria-label={isMuted ? "Unmute game audio" : "Mute game audio"}
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button
              onClick={() => { setPreviewCode(code); setIframeKey((k) => k + 1); }}
              className="w-8 h-8 rounded-lg hover:bg-white/[0.06] flex items-center justify-center text-white/30 hover:text-white/60 transition-colors"
              aria-label="Refresh game preview"
              title="Refresh preview"
            >
              <RefreshCcw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsFullscreen(true)}
              className="w-8 h-8 rounded-lg hover:bg-white/[0.06] flex items-center justify-center text-white/30 hover:text-white/60 transition-colors"
              aria-label="Enter fullscreen"
              title="Fullscreen"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>

          <div className="w-px h-5 bg-white/[0.08] mx-1" />

          {/* Action buttons */}
          <button
            onClick={() => setShowExportPanel(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-[12px] text-white/40 hover:text-white/60 transition-colors"
            title="Export game"
            aria-label="Export game"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>

          {game.status === "draft" ? (
            <button
              onClick={handlePublish}
              disabled={publishGame.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white text-[12px] font-medium transition-colors disabled:opacity-60 shadow-[0_0_16px_rgba(16,185,129,0.25)]"
            >
              {publishGame.isPending
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Globe className="w-3.5 h-3.5" />
              }
              Publish
            </button>
          ) : (
            <button
              onClick={() => {
                const slug = (game as any).slug;
                if (slug) navigator.clipboard.writeText(`${window.location.origin}/play/${slug}`).then(() =>
                  toast({ title: "Link copied!", description: "Share link is on your clipboard." })
                );
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/25 text-emerald-300 text-[12px] font-medium transition-colors"
            >
              <Share2 className="w-3.5 h-3.5" />
              Share
            </button>
          )}
        </div>

        {/* Game preview iframe */}
        <div className="relative flex-1 min-h-0 bg-black overflow-hidden">
          {/* AI is updating badge */}
          {isThinking && (
            <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 px-3 py-1.5 bg-emerald-900/70 border border-emerald-400/30 rounded-full text-[11px] font-mono text-emerald-300 backdrop-blur-md shadow-lg">
              <Sparkles className="w-3 h-3 animate-pulse" />
              AI is updating…
            </div>
          )}
          <iframe
            ref={iframeRef}
            key={iframeKey}
            srcDoc={previewCode}
            className="w-full h-full border-none"
            sandbox="allow-scripts"
            title="Game Preview"
          />
        </div>

        {/* Bottom loading bar (sprite generation) */}
        {isGeneratingSprites && (
          <div className="h-1 shrink-0 bg-black/60 overflow-hidden">
            <div className="h-full bg-emerald-400/70 animate-pulse" style={{ width: "60%", transition: "width 2s ease" }} />
          </div>
        )}
      </div>

      {/* ── Export panel ───────────────────────────────────────────────────────── */}
      {showExportPanel && (
        <ExportPanel
          gameCode={code}
          gameTitle={title}
          slug={game?.slug}
          isPublished={game?.status === "published"}
          onClose={() => setShowExportPanel(false)}
        />
      )}

      {/* ── Fullscreen overlay ─────────────────────────────────────────────────── */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          <div className="flex items-center justify-between px-4 py-2.5 bg-[#111] border-b border-white/[0.07] shrink-0">
            <div className="flex items-center gap-2.5">
              <Gamepad2 className="w-4 h-4 text-emerald-400" />
              <span className="text-[13px] font-medium text-white/60">{title}</span>
            </div>
            <button
              onClick={() => setIsFullscreen(false)}
              className="p-1.5 rounded-lg hover:bg-white/[0.08] text-white/40 hover:text-white transition-colors"
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
