import { useState, useRef, useEffect } from "react";
import {
  ArrowLeft, Play, Save, Globe, Code2, Circle, Loader2,
  ChevronRight, ChevronDown, FileCode, Settings2, Gamepad2,
  Send, Bot, User, RotateCcw, Sparkles, FolderOpen,
  Volume2, Palette, Zap, Shield
} from "lucide-react";

// ── Fake game preview canvas ──────────────────────────────────────────────────
function GamePreview() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);
  const stateRef = useRef({ playerX: 80, playerY: 160, vy: 0, bullets: [] as any[], enemies: [] as any[], score: 0, t: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const W = canvas.width;
    const H = canvas.height;
    const s = stateRef.current;

    // seed enemies
    s.enemies = [
      { x: 280, y: 60, vx: 1.2, hp: 3 },
      { x: 440, y: 100, vx: -1.0, hp: 2 },
      { x: 360, y: 40, vx: 0.8, hp: 4 },
    ];

    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 16, 3);
      last = now;
      s.t += dt;

      ctx.fillStyle = "#0a0a1a";
      ctx.fillRect(0, 0, W, H);

      // stars
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      for (let i = 0; i < 30; i++) {
        const sx = ((i * 73 + s.t * 0.3) % W);
        const sy = (i * 47) % H;
        ctx.fillRect(sx, sy, 1, 1);
      }

      // ground
      const grad = ctx.createLinearGradient(0, H - 28, 0, H);
      grad.addColorStop(0, "#1a3a1a");
      grad.addColorStop(1, "#0d1f0d");
      ctx.fillStyle = grad;
      ctx.fillRect(0, H - 28, W, 28);

      // platforms
      const platforms = [{ x: 120, y: H - 80, w: 90 }, { x: 300, y: H - 120, w: 80 }, { x: 450, y: H - 90, w: 70 }];
      platforms.forEach(p => {
        ctx.fillStyle = "#2a4a2a";
        ctx.fillRect(p.x, p.y, p.w, 12);
        ctx.fillStyle = "#3a6a3a";
        ctx.fillRect(p.x, p.y, p.w, 3);
      });

      // physics
      s.vy += 0.4 * dt;
      s.playerY += s.vy * dt;
      if (s.playerY >= H - 28 - 20) { s.playerY = H - 28 - 20; s.vy = 0; }
      platforms.forEach(p => {
        if (s.playerX + 14 > p.x && s.playerX < p.x + p.w && s.playerY + 20 > p.y && s.playerY + 20 < p.y + 18 && s.vy > 0) {
          s.playerY = p.y - 20; s.vy = 0;
        }
      });

      // auto-move player
      s.playerX += Math.sin(s.t * 0.04) * 1.2 * dt;
      s.playerX = Math.max(10, Math.min(W - 24, s.playerX));

      // shoot
      if (Math.floor(s.t / 40) % 2 === 0 && s.bullets.length < 6) {
        s.bullets.push({ x: s.playerX + 7, y: s.playerY + 5, vx: 5 });
      }

      // bullets
      s.bullets = s.bullets.filter(b => b.x < W + 10);
      s.bullets.forEach(b => { b.x += b.vx * dt; });

      // enemies
      s.enemies.forEach(e => {
        e.x += e.vx * dt;
        if (e.x > W - 20 || e.x < 0) e.vx *= -1;
        e.y = 50 + Math.sin(s.t * 0.05 + e.x * 0.01) * 20;
      });

      // hit detection
      s.bullets.forEach(b => {
        s.enemies.forEach(e => {
          if (Math.abs(b.x - e.x) < 16 && Math.abs(b.y - e.y) < 16) {
            e.hp -= 1; b.x = W + 99;
            if (e.hp <= 0) { e.x = 100 + Math.random() * (W - 200); e.hp = 3; s.score += 100; }
          }
        });
      });

      // draw player
      const px = Math.round(s.playerX), py = Math.round(s.playerY);
      ctx.fillStyle = "#22c55e";
      ctx.fillRect(px, py, 14, 18);
      ctx.fillStyle = "#4ade80";
      ctx.fillRect(px + 2, py + 2, 10, 6);
      // gun
      ctx.fillStyle = "#86efac";
      ctx.fillRect(px + 14, py + 7, 8, 3);

      // bullets
      s.bullets.forEach(b => {
        ctx.fillStyle = "#fbbf24";
        ctx.fillRect(b.x, b.y, 6, 2);
      });

      // enemies
      s.enemies.forEach(e => {
        const ex = Math.round(e.x), ey = Math.round(e.y);
        ctx.fillStyle = "#ef4444";
        ctx.beginPath();
        ctx.arc(ex + 12, ey + 12, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fca5a5";
        ctx.beginPath();
        ctx.arc(ex + 8, ey + 8, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(ex + 16, ey + 8, 4, 0, Math.PI * 2);
        ctx.fill();
        // hp bar
        ctx.fillStyle = "#450a0a";
        ctx.fillRect(ex, ey - 6, 24, 3);
        ctx.fillStyle = "#ef4444";
        ctx.fillRect(ex, ey - 6, Math.round(24 * (e.hp / 4)), 3);
      });

      // HUD
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(4, 4, 110, 18);
      ctx.fillStyle = "#22c55e";
      ctx.font = "bold 11px monospace";
      ctx.fillText(`SCORE: ${s.score}`, 10, 16);

      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={580}
      height={200}
      className="w-full h-full object-fill"
      style={{ imageRendering: "pixelated" }}
    />
  );
}

// ── Chat message types ────────────────────────────────────────────────────────
type Msg = { role: "user" | "assistant" | "error"; text: string; undoable?: boolean };

const INITIAL_MESSAGES: Msg[] = [
  { role: "assistant", text: "Hi! I'm your game AI. Describe a change and I'll update the code instantly. Try: *\"make the player faster\"* or *\"add a shield power-up\"*" },
  { role: "user", text: "make the enemies move faster and add more of them" },
  { role: "assistant", text: "✓ Enemy speed increased from 1× to 2.5× and spawned 3 additional enemies. The game now has 6 enemies total. Preview refreshed automatically." },
  { role: "user", text: "change the background to a deep space theme with nebula clouds" },
  { role: "assistant", text: "✓ Background updated with deep space gradient, star parallax layers, and two procedural nebula clouds in purple/blue. Shooting stars added every 4 seconds." },
];

// ── Code snippet (abbreviated) ────────────────────────────────────────────────
const CODE_LINES = [
  { ln: "1",  t: "comment", s: "<!DOCTYPE html>" },
  { ln: "2",  t: "tag", s: '<html lang="en">' },
  { ln: "3",  t: "tag", s: "<head>" },
  { ln: "4",  t: "attr", s: '  <title>Space Shooter</title>' },
  { ln: "12", t: "tag", s: "<script>" },
  { ln: "13", t: "comment", s: "  // Enemy configuration" },
  { ln: "14", t: "keyword", s: "  const ENEMY_SPEED = " },
  { ln: "14", t: "number", s: "2.5" },
  { ln: "14", t: "default", s: ";" },
  { ln: "15", t: "keyword", s: "  const ENEMY_COUNT = " },
  { ln: "15", t: "number", s: "6" },
  { ln: "15", t: "default", s: ";" },
  { ln: "17", t: "comment", s: "  // Background: deep space" },
  { ln: "18", t: "keyword", s: "  function " },
  { ln: "18", t: "fn", s: "drawBackground" },
  { ln: "18", t: "default", s: "() {" },
  { ln: "19", t: "string", s: '    ctx.fillStyle = "#020814"' },
  { ln: "19", t: "default", s: ";" },
  { ln: "20", t: "fn", s: "    drawNebula" },
  { ln: "20", t: "default", s: "(240, 60, 80, " },
  { ln: "20", t: "string", s: '"#4c1d95"' },
  { ln: "20", t: "default", s: ");" },
  { ln: "21", t: "fn", s: "    drawNebula" },
  { ln: "21", t: "default", s: "(480, 120, 60, " },
  { ln: "21", t: "string", s: '"#1e3a8a"' },
  { ln: "21", t: "default", s: ");" },
  { ln: "22", t: "default", s: "  }" },
  { ln: "24", t: "comment", s: "  // Spawn enemies" },
  { ln: "25", t: "keyword", s: "  for " },
  { ln: "25", t: "default", s: "(let i = 0; i < ENEMY_COUNT; i++) {" },
  { ln: "26", t: "fn", s: "    spawnEnemy" },
  { ln: "26", t: "default", s: "(i * ENEMY_SPEED);" },
  { ln: "27", t: "default", s: "  }" },
];

const tokenColor: Record<string, string> = {
  comment: "#6a9955",
  tag: "#569cd6",
  attr: "#9cdcfe",
  keyword: "#c586c0",
  number: "#b5cea8",
  string: "#ce9178",
  fn: "#dcdcaa",
  default: "#d4d4d4",
};

// ── Left sidebar ──────────────────────────────────────────────────────────────
function Sidebar() {
  const [expanded, setExpanded] = useState({ files: true, settings: false });
  return (
    <div className="w-48 bg-[#111] border-r border-white/10 flex flex-col text-xs shrink-0">
      {/* Files section */}
      <button
        className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold text-white/40 uppercase tracking-wider hover:text-white/60 transition-colors w-full"
        onClick={() => setExpanded(e => ({ ...e, files: !e.files }))}
      >
        {expanded.files ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        Files
      </button>
      {expanded.files && (
        <div className="pb-2">
          <div className="flex items-center gap-1.5 px-4 py-1 text-emerald-400 bg-emerald-400/10 cursor-pointer">
            <FileCode className="w-3 h-3" />
            <span className="truncate">index.html</span>
          </div>
          <div className="flex items-center gap-1.5 px-4 py-1 text-white/40 cursor-pointer hover:text-white/60">
            <FolderOpen className="w-3 h-3" />
            <span className="truncate">assets/</span>
          </div>
        </div>
      )}

      <div className="border-t border-white/10" />

      {/* Settings section */}
      <button
        className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold text-white/40 uppercase tracking-wider hover:text-white/60 transition-colors w-full"
        onClick={() => setExpanded(e => ({ ...e, settings: !e.settings }))}
      >
        {expanded.settings ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        Settings
      </button>
      {expanded.settings && (
        <div className="px-3 pb-3 space-y-3">
          <div>
            <label className="text-[10px] text-white/30 uppercase tracking-wider block mb-1">Genre</label>
            <div className="bg-white/5 rounded px-2 py-1 text-white/70 text-[11px]">Shooter</div>
          </div>
          <div>
            <label className="text-[10px] text-white/30 uppercase tracking-wider block mb-1">Engine</label>
            <div className="bg-white/5 rounded px-2 py-1 text-white/70 text-[11px]">Canvas 2D</div>
          </div>
        </div>
      )}

      <div className="border-t border-white/10 mt-auto" />

      {/* Quick actions */}
      <div className="p-2 space-y-1">
        {[
          { icon: Palette, label: "Theme" },
          { icon: Volume2, label: "Audio" },
          { icon: Shield, label: "Difficulty" },
          { icon: Zap, label: "Physics" },
        ].map(({ icon: Icon, label }) => (
          <button key={label} className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors">
            <Icon className="w-3 h-3" />
            <span className="text-[11px]">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Code editor panel ─────────────────────────────────────────────────────────
function CodePanel({ highlighted }: { highlighted: boolean }) {
  const groups = CODE_LINES.reduce<{ ln: string; tokens: { t: string; s: string }[] }[]>((acc, item) => {
    const last = acc[acc.length - 1];
    if (last && last.ln === item.ln) {
      last.tokens.push({ t: item.t, s: item.s });
    } else {
      acc.push({ ln: item.ln, tokens: [{ t: item.t, s: item.s }] });
    }
    return acc;
  }, []);

  return (
    <div className="flex flex-col bg-[#0d0d0d] border-l border-white/10 min-h-0" style={{ width: 280 }}>
      <div className="h-8 bg-[#111] border-b border-white/10 flex items-center px-3 shrink-0 gap-2">
        <Code2 className="w-3 h-3 text-white/30" />
        <span className="text-[11px] font-mono text-white/40">index.html</span>
        {highlighted && (
          <span className="ml-auto text-[10px] text-emerald-400/80 font-mono">● updated</span>
        )}
      </div>
      <div className="flex-1 overflow-auto p-2 font-mono text-[11px] leading-5">
        {groups.map((row, i) => (
          <div key={i} className={`flex gap-2 px-1 rounded ${i === 13 || i === 14 ? "bg-emerald-400/5" : ""}`}>
            <span className="text-white/20 w-5 text-right shrink-0 select-none">{row.ln}</span>
            <span>
              {row.tokens.map((tok, j) => (
                <span key={j} style={{ color: tokenColor[tok.t] }}>{tok.s}</span>
              ))}
            </span>
          </div>
        ))}
        <div className="h-8" />
      </div>
    </div>
  );
}

// ── AI Chat panel ─────────────────────────────────────────────────────────────
function ChatPanel({ onApplyChange }: { onApplyChange: () => void }) {
  const [messages, setMessages] = useState<Msg[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = () => {
    if (!input.trim() || loading) return;
    const text = input.trim();
    setInput("");
    setMessages(m => [...m, { role: "user", text }]);
    setLoading(true);

    setTimeout(() => {
      setLoading(false);
      const responses: Record<string, string> = {
        faster: "✓ Player speed increased from 200px/s to 320px/s. Movement feels snappier — try holding the directional keys.",
        harder: "✓ Enemy spawn rate increased by 40%, enemy HP doubled, and bullet spread widened. Good luck! 💀",
        darker: "✓ Switched to a dark horror palette — deep crimson background, desaturated sprites, blood-red UI accents.",
        forest: "✓ Background replaced with a parallax forest scene — three tree layers at different scroll speeds.",
        jump: "✓ Double jump added. First jump: 380px/s impulse. Second jump: 280px/s impulse (smaller arc). Coyote time: 80ms.",
      };
      const key = Object.keys(responses).find(k => text.toLowerCase().includes(k));
      const reply = key
        ? responses[key]
        : `✓ Applied: "${text}". The code has been updated and the preview refreshed. ${messages.length % 2 === 0 ? "Looks great!" : "Try playing it!"}`;
      setMessages(m => [...m, { role: "assistant", text: reply, undoable: true }]);
      onApplyChange();
    }, 1400);
  };

  return (
    <div className="flex flex-col bg-[#0f0f0f] border-t border-white/10 min-h-0" style={{ flex: "0 0 220px" }}>
      {/* Header */}
      <div className="h-8 bg-[#111] border-b border-white/10 flex items-center px-3 gap-2 shrink-0">
        <Sparkles className="w-3 h-3 text-emerald-400" />
        <span className="text-[11px] font-mono text-white/60">AI Game Assistant</span>
        <span className="ml-auto text-[10px] text-emerald-400/70 font-mono">claude-sonnet</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            <div className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5 ${
              msg.role === "assistant" ? "bg-emerald-400/20" : "bg-white/10"
            }`}>
              {msg.role === "assistant"
                ? <Bot className="w-3 h-3 text-emerald-400" />
                : <User className="w-3 h-3 text-white/60" />}
            </div>
            <div className={`max-w-[75%] rounded-lg px-2.5 py-1.5 text-[11px] leading-relaxed ${
              msg.role === "user"
                ? "bg-emerald-400/10 text-white/80"
                : msg.role === "error"
                ? "bg-red-900/40 text-red-300"
                : "bg-white/5 text-white/70"
            }`}>
              {msg.text.replace(/\*(.*?)\*/g, "$1")}
              {msg.undoable && (
                <button className="mt-1 flex items-center gap-1 text-[10px] text-white/30 hover:text-white/60 transition-colors">
                  <RotateCcw className="w-2.5 h-2.5" />
                  Undo this change
                </button>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-2">
            <div className="shrink-0 w-5 h-5 rounded-full bg-emerald-400/20 flex items-center justify-center">
              <Loader2 className="w-3 h-3 text-emerald-400 animate-spin" />
            </div>
            <div className="bg-white/5 rounded-lg px-2.5 py-1.5 text-[11px] text-white/40 flex items-center gap-1">
              <span>Thinking</span>
              <span className="inline-flex gap-0.5">
                {[0, 1, 2].map(n => (
                  <span key={n} className="w-1 h-1 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: `${n * 0.15}s` }} />
                ))}
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-2 border-t border-white/10 shrink-0">
        <div className="flex gap-2 items-center bg-white/5 rounded-lg px-2.5 py-1.5 border border-white/10 focus-within:border-emerald-400/40 transition-colors">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
            placeholder='e.g. "make the player faster"'
            className="flex-1 bg-transparent text-[11px] text-white/70 placeholder:text-white/25 outline-none"
          />
          <button
            onClick={send}
            disabled={!input.trim() || loading}
            className="shrink-0 w-6 h-6 rounded flex items-center justify-center bg-emerald-500 hover:bg-emerald-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-3 h-3 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Root component ────────────────────────────────────────────────────────────
export function FourPanelEditor() {
  const [highlighted, setHighlighted] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);

  const handleApplyChange = () => {
    setHighlighted(true);
    setPreviewKey(k => k + 1);
    setTimeout(() => setHighlighted(false), 3000);
  };

  return (
    <div className="flex flex-col bg-[#0a0a0a] text-white overflow-hidden" style={{ width: 1400, height: 820, fontFamily: "system-ui, sans-serif" }}>

      {/* ── Header bar ─────────────────────────────────────────────────────── */}
      <header className="h-11 px-4 border-b border-white/10 bg-[#111] flex items-center justify-between shrink-0 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button className="p-1.5 rounded hover:bg-white/5 text-white/40 hover:text-white/70 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <Gamepad2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-bold text-sm text-white truncate">Space Shooter: Nebula Assault</span>
          <span className="text-[10px] font-mono text-white/30 uppercase shrink-0">draft</span>
          <span className="flex items-center gap-1 text-[11px] font-mono text-amber-400/70 shrink-0">
            <Circle className="w-2 h-2 fill-amber-400/70" />
            unsaved
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button className="flex items-center gap-1.5 px-3 py-1 rounded border border-white/15 text-white/50 hover:text-white/80 text-xs transition-colors">
            <Play className="w-3 h-3" /> Run
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1 rounded border border-amber-400/30 text-amber-400/70 hover:bg-amber-400/10 text-xs transition-colors">
            <Save className="w-3 h-3" /> Save
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-white text-xs transition-colors shadow-[0_0_12px_rgba(34,197,94,0.3)]">
            <Globe className="w-3 h-3" /> Publish
          </button>
        </div>
      </header>

      {/* ── 4-panel body ───────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* Left: sidebar */}
        <Sidebar />

        {/* Center column: preview top + chat bottom */}
        <div className="flex flex-col flex-1 min-w-0 min-h-0">

          {/* Center top: preview */}
          <div className="flex-1 bg-black relative overflow-hidden min-h-0">
            <div className="absolute top-2 left-2 z-10 px-2 py-0.5 bg-black/60 backdrop-blur-md border border-white/10 rounded text-[9px] font-mono text-white/40 uppercase tracking-widest select-none">
              Live Preview
            </div>
            {highlighted && (
              <div className="absolute top-2 right-2 z-10 flex items-center gap-1 px-2 py-0.5 bg-emerald-400/20 border border-emerald-400/30 rounded text-[9px] font-mono text-emerald-400 animate-pulse">
                <Zap className="w-2.5 h-2.5" /> AI updated • refreshed
              </div>
            )}
            <div key={previewKey} className="w-full h-full">
              <GamePreview />
            </div>
          </div>

          {/* Center bottom: AI chat */}
          <ChatPanel onApplyChange={handleApplyChange} />
        </div>

        {/* Right: code editor */}
        <CodePanel highlighted={highlighted} />
      </div>
    </div>
  );
}
