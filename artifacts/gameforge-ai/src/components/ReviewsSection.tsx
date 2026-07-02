import { useState } from "react";
import { Star, ThumbsUp, Flag, MessageSquare, ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@clerk/react";
import { toast } from "@/hooks/use-toast";
import { useGetReviews, useMarkHelpful, useCreateReply, useFlagReview } from "@workspace/api-client-react";
import type { Review } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetReviewsQueryKey } from "@workspace/api-client-react";

interface ReviewsSectionProps {
  gameId: number;
  creatorId: string;
  averageRating: number | null;
  ratingCount: number;
}

function StarRow({ rating, size = "sm" }: { rating: number; size?: "sm" | "xs" }) {
  const cls = size === "xs" ? "w-3 h-3" : "w-4 h-4";
  return (
    <span className="flex gap-0.5" aria-label={`${rating} out of 10`}>
      {Array.from({ length: 10 }, (_, i) => (
        <Star
          key={i}
          className={cn(cls, i < rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/20")}
        />
      ))}
    </span>
  );
}

function timeAgo(date: string) {
  const d = new Date(date);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString();
}

function ReviewCard({
  review,
  gameId,
  isCreator,
  isSignedIn,
}: {
  review: Review;
  gameId: number;
  isCreator: boolean;
  isSignedIn: boolean;
}) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const qc = useQueryClient();
  const qKey = getGetReviewsQueryKey({ id: gameId });

  const helpful = useMarkHelpful({
    mutation: {
      onSuccess: (data) => {
        qc.setQueryData(qKey, (old: Review[] | undefined) =>
          old?.map((r) =>
            r.id === review.id ? { ...r, helpfulCount: data.helpfulCount, isHelpful: data.helpful } : r,
          ),
        );
      },
      onError: () => toast({ title: "Couldn't update", description: "Please try again.", variant: "destructive" }),
    },
  });

  const reply = useCreateReply({
    mutation: {
      onSuccess: (updated) => {
        qc.setQueryData(qKey, (old: Review[] | undefined) =>
          old?.map((r) => (r.id === review.id ? { ...r, ...updated } : r)),
        );
        setReplyOpen(false);
        setReplyText("");
        toast({ title: "Reply posted!" });
      },
    },
  });

  const flag = useFlagReview({
    mutation: {
      onSuccess: () => {
        qc.setQueryData(qKey, (old: Review[] | undefined) =>
          old?.filter((r) => r.id !== review.id),
        );
        toast({ title: "Review flagged", description: "Thank you for keeping the community safe." });
      },
      onError: () => toast({ title: "Could not flag", description: "Please try again.", variant: "destructive" }),
    },
  });

  return (
    <div className="bg-card/50 border border-border rounded-xl p-4 space-y-3">
      {/* Author + rating */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-xs font-bold text-primary shrink-0">
            {review.authorName[0]?.toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold leading-none">{review.authorName}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{timeAgo(review.createdAt)}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <StarRow rating={review.rating} size="xs" />
          <span className="text-xs font-bold text-yellow-400">{review.rating}/10</span>
        </div>
      </div>

      {/* Body */}
      {review.body && (
        <p className="text-sm text-muted-foreground leading-relaxed">{review.body}</p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          disabled={!isSignedIn || helpful.isPending}
          onClick={() => helpful.mutate({ id: gameId, reviewId: review.id })}
          className={cn(
            "flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors",
            review.isHelpful
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:text-foreground hover:bg-white/5",
          )}
        >
          <ThumbsUp className="w-3.5 h-3.5" />
          Helpful{review.helpfulCount > 0 && ` (${review.helpfulCount})`}
        </button>

        {isCreator && !review.replyText && (
          <button
            onClick={() => setReplyOpen((v) => !v)}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Reply
          </button>
        )}

        {isSignedIn && (
          <button
            onClick={() => flag.mutate({ id: gameId, reviewId: review.id })}
            disabled={flag.isPending}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-red-400 hover:border-red-400/30 transition-colors ml-auto"
          >
            <Flag className="w-3 h-3" />
            Flag
          </button>
        )}
      </div>

      {/* Creator reply */}
      {review.replyText && (
        <div className="ml-4 pl-3 border-l-2 border-primary/30">
          <p className="text-xs font-semibold text-primary mb-1">Creator's reply</p>
          <p className="text-sm text-muted-foreground">{review.replyText}</p>
        </div>
      )}

      {/* Reply box */}
      {replyOpen && (
        <div className="ml-4 space-y-2 animate-in fade-in duration-200">
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value.slice(0, 500))}
            placeholder="Write a reply to this review…"
            rows={2}
            className="w-full px-3 py-2 bg-black/30 border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-primary focus:border-primary outline-none resize-none"
          />
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setReplyOpen(false)}>Cancel</Button>
            <Button
              size="sm"
              disabled={!replyText.trim() || reply.isPending}
              onClick={() => reply.mutate({ id: gameId, reviewId: review.id, data: { replyText } })}
            >
              {reply.isPending ? "Posting…" : "Post reply"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReviewsSection({ gameId, creatorId, averageRating, ratingCount }: ReviewsSectionProps) {
  const { isSignedIn, userId } = useAuth();
  const [limit, setLimit] = useState(5);

  const { data: reviews, isLoading } = useGetReviews(
    { id: gameId },
    { query: { queryKey: getGetReviewsQueryKey({ id: gameId }), enabled: !!gameId } },
  );

  const isCreator = !!userId && userId === creatorId;
  const visible = reviews?.slice(0, limit) ?? [];
  const hasMore = (reviews?.length ?? 0) > limit;

  return (
    <section className="max-w-3xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-display font-bold text-2xl">Community Reviews</h2>
          {ratingCount > 0 && averageRating != null && (
            <div className="flex items-center gap-2 mt-1">
              <StarRow rating={Math.round(averageRating)} />
              <span className="text-sm font-bold text-yellow-400">{averageRating.toFixed(1)}/10</span>
              <span className="text-sm text-muted-foreground">({ratingCount} {ratingCount === 1 ? "rating" : "ratings"})</span>
            </div>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-12 bg-card/30 border border-dashed border-border rounded-2xl">
          <Star className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">No reviews yet. Play for 30 seconds to leave one!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((r) => (
            <ReviewCard
              key={r.id}
              review={r}
              gameId={gameId}
              isCreator={isCreator}
              isSignedIn={!!isSignedIn}
            />
          ))}
          {hasMore && (
            <button
              onClick={() => setLimit((l) => l + 5)}
              className="w-full flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronDown className="w-4 h-4" /> Show more reviews
            </button>
          )}
        </div>
      )}
    </section>
  );
}
