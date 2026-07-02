import { useState } from "react";
import { Star, X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface RatingPromptProps {
  gameTitle: string;
  onSubmit: (rating: number, body: string) => void;
  onDismiss: () => void;
  isSubmitting?: boolean;
}

export default function RatingPrompt({ gameTitle, onSubmit, onDismiss, isSubmitting }: RatingPromptProps) {
  const [hovered, setHovered] = useState(0);
  const [selected, setSelected] = useState(0);
  const [body, setBody] = useState("");

  const display = hovered || selected;

  const label =
    display === 0 ? "Tap a star to rate"
    : display <= 2 ? "Not for me"
    : display <= 4 ? "Could be better"
    : display <= 6 ? "It's alright"
    : display <= 8 ? "Really fun!"
    : display === 9 ? "Amazing!"
    : "Perfect — 10/10!";

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-3">
          <div>
            <p className="text-xs font-medium text-primary uppercase tracking-wider mb-1">You've been playing for 30 seconds!</p>
            <h3 className="font-display font-bold text-lg leading-tight">How is <span className="text-primary">{gameTitle}</span>?</h3>
          </div>
          <Button variant="ghost" size="icon" onClick={onDismiss} className="-mr-2 -mt-1 text-muted-foreground" aria-label="Dismiss">
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="px-5 pb-5 space-y-4">
          {/* Stars */}
          <div className="text-center">
            <div
              className="flex justify-center gap-1.5 mb-2"
              onMouseLeave={() => setHovered(0)}
              role="group"
              aria-label="Rating 1 to 10"
            >
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onMouseEnter={() => setHovered(n)}
                  onClick={() => setSelected(n)}
                  aria-label={`Rate ${n} out of 10`}
                  className="p-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                >
                  <Star
                    className={cn(
                      "w-7 h-7 transition-all duration-100",
                      n <= display
                        ? "fill-yellow-400 text-yellow-400 scale-110"
                        : "text-muted-foreground/30 hover:text-yellow-300",
                    )}
                  />
                </button>
              ))}
            </div>
            <p className={cn("text-sm font-medium transition-colors", display > 0 ? "text-foreground" : "text-muted-foreground")}>
              {display > 0 && <span className="font-bold text-yellow-400 mr-1">{display}/10</span>}
              {label}
            </p>
          </div>

          {/* Review text */}
          {selected > 0 && (
            <div className="animate-in fade-in duration-200">
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value.slice(0, 500))}
                placeholder="Share what you loved or what could be better… (optional)"
                rows={3}
                className="w-full px-3 py-2.5 bg-black/30 border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-primary focus:border-primary outline-none resize-none"
              />
              <p className="text-xs text-muted-foreground text-right mt-1">{body.length}/500</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onDismiss} className="flex-1">
              Maybe later
            </Button>
            <Button
              onClick={() => selected > 0 && onSubmit(selected, body)}
              disabled={selected === 0 || isSubmitting}
              className="flex-1 gap-2"
            >
              <Send className="w-4 h-4" />
              {isSubmitting ? "Submitting…" : "Submit rating"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
