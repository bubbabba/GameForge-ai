import { useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@clerk/react";
import {
  useSaveGame,
  useListPublicGames,
  getListPublicGamesQueryKey,
} from "@workspace/api-client-react";
import { streamPost } from "@/lib/streamPost";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import {
  Sparkles,
  Code,
  LayoutGrid,
  Loader2,
  ArrowRight,
  LogIn,
  CheckCircle2,
  Edit3,
  FileText,
  User,
  Zap,
  Skull,
  Map,
  Trophy,
  Heart,
  Palette,
  RotateCcw,
  Layers,
} from "lucide-react";
import GameCard from "@/components/GameCard";
import { useQueryClient } from "@tanstack/react-query";
import { GENRE_COLORS } from "@/lib/constants";

// ── Types ─────────────────────────────────────────────────────────────────────

interface GamePlan {
  title: string;
  concept: string;
  playerCharacter: string;
  mainMechanic: string;
  enemies: string;
  levelStructure: string;
  winCondition: string;
  loseCondition: string;
  visualStyle: string;
  features: string[];
}

type PlanPhase = "idle" | "planning" | "plan_ready" | "refining";

function formatPlanForGeneration(plan: GamePlan, genre: string): string {
  return `APPROVED GAME DESIGN DOCUMENT
═══════════════════════════════════════

TITLE: ${plan.title}
GENRE: ${genre}

CORE CONCEPT:
${plan.concept}

PLAYER CHARACTER:
${plan.playerCharacter}

MAIN MECHANIC:
${plan.mainMechanic}

ENEMIES & CHALLENGES:
${plan.enemies}

LEVEL STRUCTURE:
${plan.levelStructure}

WIN CONDITION: ${plan.winCondition}
LOSE CONDITION: ${plan.loseCondition}

VISUAL STYLE:
${plan.visualStyle}

KEY FEATURES:
${plan.features.map((f, i) => `${i + 1}. ${f}`).join("\n")}`;
}

// ── Plan section sub-component ────────────────────────────────────────────────

const ACCENT: Record<string, { border: string; icon: string; bg: string }> = {
  emerald: { border: "border-emerald-500/20", icon: "text-emerald-400", bg: "bg-emerald-500/5" },
  sky:     { border: "border-sky-500/20",     icon: "text-sky-400",     bg: "bg-sky-500/5"     },
  amber:   { border: "border-amber-500/20",   icon: "text-amber-400",   bg: "bg-amber-500/5"   },
  red:     { border: "border-red-500/20",     icon: "text-red-400",     bg: "bg-red-500/5"     },
  purple:  { border: "border-purple-500/20",  icon: "text-purple-400",  bg: "bg-purple-500/5"  },
  violet:  { border: "border-violet-500/20",  icon: "text-violet-400",  bg: "bg-violet-500/5"  },
};

function PlanSection({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  accent: string;
}) {
  const a = ACCENT[accent] ?? ACCENT.emerald;
  return (
    <div className={cn("p-3.5 rounded-xl border bg-card/50", a.border)}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className={cn("w-3.5 h-3.5 shrink-0", a.icon)} />
        <span className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">
          {label}
        </span>
      </div>
      <p className="text-[13px] text-white/80 leading-relaxed">{value}</p>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function Home() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { isSignedIn } = useAuth();
  const isSignedInRef = useRef(isSignedIn);
  isSignedInRef.current = isSignedIn;

  const [prompt, setPrompt] = useState("");

  // Plan state
  const [planPhase, setPlanPhase] = useState<PlanPhase>("idle");
  const [plan, setPlan] = useState<GamePlan | null>(null);
  const [planPrompt, setPlanPrompt] = useState(""); // prompt that generated the current plan
  const [detectedEngine, setDetectedEngine] = useState<"2d" | "3d">("2d");
  const [detectedGenre, setDetectedGenre] = useState("Platformer");
  const [adjustFeedback, setAdjustFeedback] = useState("");
  const [showAdjustBox, setShowAdjustBox] = useState(false);

  // True when the user has edited the prompt after a plan was generated
  const isPlanStale = plan !== null && prompt.trim() !== planPrompt;

  // Generation state (after approval)
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Holds generated data when user is NOT signed in
  const [guestPreview, setGuestPreview] = useState<{
    gameCode: string;
    title: string;
    genre: string;
    engine: "2d" | "3d";
    prompt: string;
    qualityScore?: number;
    gamePlan?: string;
    gameContextJson?: string;
    generationStatus?: string;
  } | null>(null);

  const saveGame = useSaveGame();
  const { data: recentGames, isLoading: loadingGames } = useListPublicGames(
    { limit: 6 },
    { query: { queryKey: getListPublicGamesQueryKey({ limit: 6 }) } },
  );

  const isBusy =
    planPhase === "planning" ||
    planPhase === "refining" ||
    isGenerating ||
    saveGame.isPending;

  // ── Step 1: Generate plan ────────────────────────────────────────────────────

  const handlePlan = async () => {
    if (!prompt.trim()) {
      toast({
        title: "Prompt required",
        description: "Please describe your game.",
        variant: "destructive",
      });
      return;
    }

    setPlan(null);
    setGuestPreview(null);
    setGenerateError(null);
    setShowAdjustBox(false);
    setAdjustFeedback("");
    setPlanPhase("planning");
    setStatusMessage("Designing your game plan…");

    try {
      const data = await streamPost<{
        plan: GamePlan;
        engine: "2d" | "3d";
        genre: string;
      }>("/api/games/plan", { prompt }, (msg) => setStatusMessage(msg));

      setPlan(data.plan);
      setPlanPrompt(prompt.trim()); // track which prompt generated this plan
      setDetectedEngine(data.engine);
      setDetectedGenre(data.genre);
      setPlanPhase("plan_ready");
    } catch (err: any) {
      setGenerateError(err?.error || "Failed to generate game plan. Please try again.");
      setPlanPhase("idle");
    } finally {
      setStatusMessage(null);
    }
  };

  // ── Step 1b: Refine plan ─────────────────────────────────────────────────────

  const handleRefinePlan = async () => {
    if (!plan || !adjustFeedback.trim()) return;

    setPlanPhase("refining");
    setStatusMessage("Refining your game plan…");
    setGenerateError(null);

    try {
      const data = await streamPost<{ plan: GamePlan }>(
        "/api/games/plan/refine",
        { planJson: JSON.stringify(plan), feedback: adjustFeedback },
        (msg) => setStatusMessage(msg),
      );
      setPlan(data.plan);
      setAdjustFeedback("");
      setShowAdjustBox(false);
      setPlanPhase("plan_ready");
    } catch (err: any) {
      setGenerateError(err?.error || "Failed to refine plan. Please try again.");
      setPlanPhase("plan_ready");
    } finally {
      setStatusMessage(null);
    }
  };

  // ── Step 2: Approve plan → generate game ─────────────────────────────────────

  const handleApprovePlan = async () => {
    if (!plan) return;

    const approvedPlan = formatPlanForGeneration(plan, detectedGenre);
    setGenerateError(null);
    setIsGenerating(true);
    setStatusMessage("Starting game generation…");

    try {
      const data = await streamPost<{
        gameCode: string;
        title: string;
        engine: "2d" | "3d";
        genre: string;
        qualityScore?: number;
        gamePlan?: string;
        gameContextJson?: string;
        needsSpriteGeneration?: boolean;
      }>(
        "/api/games/generate",
        { prompt, approvedPlan },
        (msg) => setStatusMessage(msg),
      );

      const resolvedGenre = data.genre ?? detectedGenre;
      const resolvedEngine = data.engine ?? detectedEngine;
      const generationStatus = data.needsSpriteGeneration ? "sprites_pending" : "complete";

      if (isSignedInRef.current) {
        saveGame.mutate(
          {
            data: {
              title: data.title,
              genre: resolvedGenre,
              prompt,
              gameCode: data.gameCode,
              gamePlan: data.gamePlan,
              gameContext: data.gameContextJson,
              generationStatus,
            },
          },
          {
            onSuccess: (saved) => {
              queryClient.invalidateQueries({ queryKey: ["/api/games/my"] });
              if (data.gamePlan) {
                sessionStorage.setItem(`gamePlan_${saved.id}`, data.gamePlan);
              }
              setPlanPhase("idle");
              setPlan(null);
              setLocation(`/game/${saved.id}`);
            },
            onError: (err: any) => {
              toast({
                title: "Save failed",
                description: err?.error || "Could not auto-save your game.",
                variant: "destructive",
              });
            },
          },
        );
      } else {
        setGuestPreview({
          gameCode: data.gameCode,
          title: data.title,
          genre: resolvedGenre,
          engine: resolvedEngine,
          prompt,
          qualityScore: data.qualityScore,
          gamePlan: data.gamePlan,
          gameContextJson: data.gameContextJson,
          generationStatus,
        });
        setPlanPhase("idle");
        setPlan(null);
      }
    } catch (err: any) {
      setGenerateError(err?.error || "Generation failed. Please try again.");
      // Return to plan_ready so user can retry or adjust
      setPlanPhase("plan_ready");
    } finally {
      setIsGenerating(false);
      setStatusMessage(null);
    }
  };

  // ── Guest save ───────────────────────────────────────────────────────────────

  const handleGuestSave = () => {
    if (!guestPreview) return;
    saveGame.mutate(
      {
        data: {
          title: guestPreview.title,
          genre: guestPreview.genre,
          prompt: guestPreview.prompt,
          gameCode: guestPreview.gameCode,
          gamePlan: guestPreview.gamePlan,
          gameContext: guestPreview.gameContextJson,
          generationStatus: guestPreview.generationStatus,
        },
      },
      {
        onSuccess: (saved) => {
          queryClient.invalidateQueries({ queryKey: ["/api/games/my"] });
          if (guestPreview.gamePlan) {
            sessionStorage.setItem(`gamePlan_${saved.id}`, guestPreview.gamePlan);
          }
          setLocation(`/game/${saved.id}`);
        },
        onError: (err: any) => {
          toast({
            title: "Save failed",
            description: err?.error || "Could not save your game.",
            variant: "destructive",
          });
        },
      },
    );
  };

  // ── Button label helper ──────────────────────────────────────────────────────

  const buttonLabel = () => {
    if (planPhase === "planning") return statusMessage ?? "Designing plan…";
    if (isGenerating) return statusMessage ?? "Building game…";
    if (saveGame.isPending) return "Saving draft…";
    if (planPhase === "plan_ready" || planPhase === "refining") return "Revise Prompt";
    return "Create Game";
  };

  const buttonIcon = () => {
    if (isBusy) return <Loader2 className="w-5 h-5 mr-2 animate-spin" />;
    if (planPhase === "plan_ready") return <RotateCcw className="w-5 h-5 mr-2" />;
    return <Sparkles className="w-5 h-5 mr-2" />;
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex flex-col">
      {/* ── Hero Section ──────────────────────────────────────────────────── */}
      <div className="relative pt-20 pb-14 px-6 lg:px-12 flex flex-col items-center border-b border-border overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative z-10 w-full max-w-4xl mx-auto text-center space-y-6">
          <div className="space-y-3">
            <h1 className="text-5xl md:text-7xl font-display font-bold tracking-tight">
              What game will you{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-emerald-300">
                forge
              </span>{" "}
              today?
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Describe any game you can imagine — our AI designs a plan first, then builds it
              exactly the way you want.
            </p>
          </div>

          {/* Creator card */}
          <div className="bg-card border border-border p-4 rounded-2xl shadow-2xl shadow-black/50">
            <textarea
              data-testid="prompt-input"
              className="w-full h-40 bg-transparent text-foreground placeholder:text-muted-foreground/50 resize-none border-none focus:ring-0 p-2 text-lg"
              placeholder="Describe any game you can imagine…"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={isBusy}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handlePlan();
              }}
            />

            <div className="flex items-center justify-between gap-4 pt-4 border-t border-border mt-2">
              <p className="text-xs text-muted-foreground/60 hidden sm:block">
                {planPhase === "plan_ready"
                  ? "Review the plan below, then approve or adjust it"
                  : "AI designs your game plan first, then builds it — you approve before any code is written"}
              </p>
              <Button
                size="lg"
                onClick={planPhase === "plan_ready" ? handlePlan : handlePlan}
                disabled={isBusy || !prompt.trim()}
                data-testid="create-game-button"
                className="w-full sm:w-auto shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-8 shadow-[0_0_20px_rgba(217,162,62,0.3)] hover:shadow-[0_0_30px_rgba(217,162,62,0.4)] transition-all"
              >
                {buttonIcon()}
                {buttonLabel()}
              </Button>
            </div>
          </div>

          {/* Error state */}
          {generateError && (
            <div
              data-testid="generate-error"
              className="p-4 bg-destructive/10 border border-destructive/30 text-destructive rounded-lg text-sm text-left"
            >
              <span className="font-semibold">Something went wrong.</span> {generateError}
            </div>
          )}
        </div>
      </div>

      {/* ── Plan card ──────────────────────────────────────────────────────── */}
      {plan && (planPhase === "plan_ready" || planPhase === "refining") && (
        <div className="px-6 lg:px-12 py-10 border-b border-border bg-black/20">
          <div className="max-w-4xl mx-auto space-y-4">
            {/* Header badge */}
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-400/20 rounded-full">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
                  Game Plan Ready
                </span>
              </div>
              <span className="text-[12px] text-muted-foreground">
                Review and approve to start building
              </span>
            </div>

            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-2xl shadow-black/50">
              {/* Title band */}
              <div className="px-6 py-5 border-b border-border bg-gradient-to-r from-emerald-950/40 to-transparent">
                <h2 className="text-3xl font-display font-bold text-white mb-2.5">
                  {plan.title}
                </h2>
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={cn(
                      "inline-block px-3 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider border",
                      GENRE_COLORS[detectedGenre] ??
                        "bg-primary/20 text-primary border-primary/30",
                    )}
                  >
                    {detectedGenre}
                  </span>
                  <span
                    className={cn(
                      "inline-block px-2.5 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider border",
                      detectedEngine === "3d"
                        ? "bg-violet-500/20 text-violet-400 border-violet-500/30"
                        : "bg-sky-500/20 text-sky-400 border-sky-500/30",
                    )}
                  >
                    {detectedEngine === "3d" ? "Three.js 3D" : "Phaser.js 2D"}
                  </span>
                </div>
              </div>

              {/* Section grid */}
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-3">
                <PlanSection icon={FileText} label="Core Concept"     value={plan.concept}         accent="emerald" />
                <PlanSection icon={User}     label="Player Character"  value={plan.playerCharacter}  accent="sky"     />
                <PlanSection icon={Zap}      label="Main Mechanic"     value={plan.mainMechanic}     accent="amber"   />
                <PlanSection icon={Skull}    label="Enemies"           value={plan.enemies}          accent="red"     />
                <PlanSection icon={Layers}   label="Level Structure"   value={plan.levelStructure}   accent="purple"  />
                <PlanSection icon={Palette}  label="Visual Style"      value={plan.visualStyle}      accent="violet"  />
                <PlanSection icon={Trophy}   label="Win Condition"     value={plan.winCondition}     accent="emerald" />
                <PlanSection icon={Heart}    label="Lose Condition"    value={plan.loseCondition}    accent="red"     />
              </div>

              {/* Feature chips */}
              {plan.features.length > 0 && (
                <div className="px-6 pb-5">
                  <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-2.5">
                    Planned Features
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {plan.features.map((f, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-400/20 rounded-full text-[11px] text-emerald-300/90"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Stale-plan warning */}
              {isPlanStale && (
                <div className="mx-6 mb-4 px-4 py-2.5 rounded-lg bg-amber-500/10 border border-amber-400/20 text-[12px] text-amber-300/80 flex items-center gap-2">
                  <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                  Your prompt has changed since this plan was designed. Click <strong className="mx-0.5">"Revise Prompt"</strong> above to generate a fresh plan, or approve this one as-is.
                </div>
              )}

              {/* Action area */}
              <div
                className={cn(
                  "px-6 py-5 border-t border-border bg-black/20 transition-opacity",
                  planPhase === "refining" && "opacity-50 pointer-events-none",
                )}
              >
                {!showAdjustBox ? (
                  <div className="flex items-center gap-3 flex-wrap">
                    <Button
                      onClick={handleApprovePlan}
                      disabled={isGenerating || saveGame.isPending}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-[0_0_20px_rgba(217,162,62,0.3)] hover:shadow-[0_0_30px_rgba(217,162,62,0.4)]"
                    >
                      {isGenerating ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4 mr-2" />
                      )}
                      {isGenerating
                        ? (statusMessage ?? "Building game…")
                        : "Approve & Build Game"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowAdjustBox(true)}
                      disabled={isGenerating}
                      className="border-border text-white/70 hover:text-white"
                    >
                      <Edit3 className="w-4 h-4 mr-2" />
                      Adjust Plan
                    </Button>
                    {isGenerating && statusMessage && (
                      <p className="text-sm text-muted-foreground ml-1">{statusMessage}</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-white/60">
                      What would you like to change?
                    </p>
                    <textarea
                      value={adjustFeedback}
                      onChange={(e) => setAdjustFeedback(e.target.value)}
                      placeholder='e.g. "make it scarier", "add a double jump", "set it in space", "make enemies faster"'
                      rows={2}
                      className="w-full bg-background/50 border border-border focus:border-primary/50 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 resize-none focus:ring-0 focus:outline-none transition-colors"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey))
                          handleRefinePlan();
                      }}
                      autoFocus
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={handleRefinePlan}
                        disabled={!adjustFeedback.trim() || planPhase === "refining"}
                      >
                        {planPhase === "refining" ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : null}
                        {planPhase === "refining" ? "Refining…" : "Apply Changes"}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setShowAdjustBox(false);
                          setAdjustFeedback("");
                        }}
                        className="text-muted-foreground"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Guest preview ──────────────────────────────────────────────────── */}
      {guestPreview && (
        <div className="px-6 lg:px-12 py-10 border-b border-border bg-black/40">
          <div className="max-w-6xl mx-auto space-y-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-3xl font-display font-bold">{guestPreview.title}</h2>
                <div className="flex items-center gap-2 mt-2">
                  <span
                    className={cn(
                      "inline-block px-3 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider border",
                      GENRE_COLORS[guestPreview.genre] ??
                        "bg-primary/20 text-primary border-primary/30",
                    )}
                  >
                    {guestPreview.genre}
                  </span>
                  <span
                    className={cn(
                      "inline-block px-2.5 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider border",
                      guestPreview.engine === "3d"
                        ? "bg-violet-500/20 text-violet-400 border-violet-500/30"
                        : "bg-sky-500/20 text-sky-400 border-sky-500/30",
                    )}
                  >
                    {guestPreview.engine === "3d" ? "Three.js 3D" : "Phaser.js 2D"}
                  </span>
                  {guestPreview.qualityScore != null && (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold border",
                        guestPreview.qualityScore >= 80
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                          : guestPreview.qualityScore >= 60
                          ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                          : "bg-orange-500/20 text-orange-400 border-orange-500/30",
                      )}
                      title="AI-assessed quality score"
                    >
                      ★ {guestPreview.qualityScore}/100
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                {isSignedIn ? (
                  <Button
                    onClick={handleGuestSave}
                    disabled={saveGame.isPending}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                    data-testid="save-draft-button"
                  >
                    {saveGame.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Code className="w-4 h-4 mr-2" />
                    )}
                    Save &amp; Open Editor
                  </Button>
                ) : (
                  <Link href="/sign-in">
                    <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_15px_rgba(217,162,62,0.3)]">
                      <LogIn className="w-4 h-4 mr-2" />
                      Sign in to save &amp; edit
                    </Button>
                  </Link>
                )}
              </div>
            </div>

            {!isSignedIn && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-primary/5 border border-primary/20 text-sm text-primary/80">
                <LogIn className="w-4 h-4 shrink-0" />
                <span>
                  <strong>Sign in to save this game.</strong> You can play it right now — sign in
                  first to keep it and open the code editor.
                </span>
              </div>
            )}

            <div className="w-full aspect-[16/10] rounded-xl overflow-hidden border border-border bg-card shadow-2xl relative">
              <iframe
                srcDoc={guestPreview.gameCode}
                className="w-full h-full border-none bg-black"
                sandbox="allow-scripts"
                title="Generated Game"
                data-testid="game-iframe"
              />
              <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-xl pointer-events-none" />
            </div>

            {guestPreview.engine === "3d" && (
              <p className="text-xs text-muted-foreground text-center">
                3D games use Three.js. Click inside the frame first, then use keyboard controls
                shown on screen.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Community Preview ──────────────────────────────────────────────── */}
      <div className="px-6 lg:px-12 py-16 max-w-7xl mx-auto w-full">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-display font-bold flex items-center gap-2">
            <LayoutGrid className="w-6 h-6 text-primary" />
            Recently Forged
          </h2>
          <Link href="/explore">
            <Button variant="ghost" className="text-muted-foreground hover:text-foreground">
              View all <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>

        {loadingGames ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-[280px] bg-card/50 border border-border rounded-xl animate-pulse"
              />
            ))}
          </div>
        ) : recentGames && recentGames.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recentGames.map((game) => (
              <GameCard key={game.id} game={game} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground bg-card/50 rounded-xl border border-dashed border-border">
            No games published yet. Be the first to forge one.
          </div>
        )}
      </div>
    </div>
  );
}
