/**
 * Extra hand-written hooks for play count, reviews, and related features.
 * These extend the orval-generated api.ts without modifying the generated file.
 */
import { useMutation, useQuery } from "@tanstack/react-query";
import type {
  MutationFunction,
  QueryFunction,
  QueryKey,
  UseMutationOptions,
  UseMutationResult,
  UseQueryOptions,
  UseQueryResult,
} from "@tanstack/react-query";
import { customFetch } from "../custom-fetch";
import type { ErrorType } from "../custom-fetch";
import type {
  Review,
  CreateReviewBody,
  CreateReplyBody,
  RecordPlayResult,
  MarkHelpfulResult,
  ErrorResponse,
} from "./api.schemas";

type SecondParameter<T extends (...args: never) => unknown> = Parameters<T>[1];
type AwaitedReturn<T extends (...args: never) => unknown> = Awaited<ReturnType<T>>;

// ── Record Play ───────────────────────────────────────────────────────────────

export const recordPlay = async (
  { id }: { id: number },
  options?: RequestInit,
): Promise<RecordPlayResult> =>
  customFetch<RecordPlayResult>(`/api/games/${id}/play`, { ...options, method: "POST" });

export const useRecordPlay = <TError = ErrorType<ErrorResponse>, TContext = unknown>(
  options?: {
    mutation?: UseMutationOptions<RecordPlayResult, TError, { id: number }, TContext>;
    request?: SecondParameter<typeof customFetch>;
  },
): UseMutationResult<RecordPlayResult, TError, { id: number }, TContext> => {
  const { mutation: mutationOptions, request: requestOptions } = options ?? {};
  const mutationFn: MutationFunction<RecordPlayResult, { id: number }> = ({ id }) =>
    recordPlay({ id }, requestOptions);
  return useMutation({ mutationFn, ...mutationOptions });
};

// ── Get Reviews ───────────────────────────────────────────────────────────────

export const getReviews = async (
  { id }: { id: number },
  options?: RequestInit,
): Promise<Review[]> =>
  customFetch<Review[]>(`/api/games/${id}/reviews`, { ...options, method: "GET" });

export const getGetReviewsQueryKey = ({ id }: { id: number }) =>
  [`/api/games/${id}/reviews`] as const;
export type GetReviewsQueryKey = ReturnType<typeof getGetReviewsQueryKey>;

export const useGetReviews = <
  TData = AwaitedReturn<typeof getReviews>,
  TError = ErrorType<ErrorResponse>,
>(
  { id }: { id: number },
  options?: {
    query?: UseQueryOptions<AwaitedReturn<typeof getReviews>, TError, TData, GetReviewsQueryKey>;
    request?: SecondParameter<typeof customFetch>;
  },
): UseQueryResult<TData, TError> & { queryKey: QueryKey } => {
  const { query: queryOptions, request: requestOptions } = options ?? {};
  const queryKey = queryOptions?.queryKey ?? getGetReviewsQueryKey({ id });
  const queryFn: QueryFunction<AwaitedReturn<typeof getReviews>> = ({ signal }) =>
    getReviews({ id }, { signal, ...requestOptions });
  const query = useQuery({ queryKey, queryFn, ...queryOptions }) as UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
  };
  query.queryKey = queryKey;
  return query;
};

// ── Create Review ─────────────────────────────────────────────────────────────

export const createReview = async (
  { id, data }: { id: number; data: CreateReviewBody },
  options?: RequestInit,
): Promise<Review> =>
  customFetch<Review>(`/api/games/${id}/reviews`, {
    ...options,
    method: "POST",
    headers: { "Content-Type": "application/json", ...options?.headers },
    body: JSON.stringify(data),
  });

export const useCreateReview = <TError = ErrorType<ErrorResponse>, TContext = unknown>(
  options?: {
    mutation?: UseMutationOptions<Review, TError, { id: number; data: CreateReviewBody }, TContext>;
    request?: SecondParameter<typeof customFetch>;
  },
): UseMutationResult<Review, TError, { id: number; data: CreateReviewBody }, TContext> => {
  const { mutation: mutationOptions, request: requestOptions } = options ?? {};
  const mutationFn: MutationFunction<Review, { id: number; data: CreateReviewBody }> = ({
    id,
    data,
  }) => createReview({ id, data }, requestOptions);
  return useMutation({ mutationFn, ...mutationOptions });
};

// ── Mark Helpful ──────────────────────────────────────────────────────────────

export const markHelpful = async (
  { id, reviewId }: { id: number; reviewId: number },
  options?: RequestInit,
): Promise<MarkHelpfulResult> =>
  customFetch<MarkHelpfulResult>(`/api/games/${id}/reviews/${reviewId}/helpful`, {
    ...options,
    method: "POST",
  });

export const useMarkHelpful = <TError = ErrorType<ErrorResponse>, TContext = unknown>(
  options?: {
    mutation?: UseMutationOptions<
      MarkHelpfulResult,
      TError,
      { id: number; reviewId: number },
      TContext
    >;
    request?: SecondParameter<typeof customFetch>;
  },
): UseMutationResult<MarkHelpfulResult, TError, { id: number; reviewId: number }, TContext> => {
  const { mutation: mutationOptions, request: requestOptions } = options ?? {};
  const mutationFn: MutationFunction<MarkHelpfulResult, { id: number; reviewId: number }> = ({
    id,
    reviewId,
  }) => markHelpful({ id, reviewId }, requestOptions);
  return useMutation({ mutationFn, ...mutationOptions });
};

// ── Create Reply ──────────────────────────────────────────────────────────────

export const createReply = async (
  { id, reviewId, data }: { id: number; reviewId: number; data: CreateReplyBody },
  options?: RequestInit,
): Promise<Review> =>
  customFetch<Review>(`/api/games/${id}/reviews/${reviewId}/reply`, {
    ...options,
    method: "POST",
    headers: { "Content-Type": "application/json", ...options?.headers },
    body: JSON.stringify(data),
  });

export const useCreateReply = <TError = ErrorType<ErrorResponse>, TContext = unknown>(
  options?: {
    mutation?: UseMutationOptions<
      Review,
      TError,
      { id: number; reviewId: number; data: CreateReplyBody },
      TContext
    >;
    request?: SecondParameter<typeof customFetch>;
  },
): UseMutationResult<
  Review,
  TError,
  { id: number; reviewId: number; data: CreateReplyBody },
  TContext
> => {
  const { mutation: mutationOptions, request: requestOptions } = options ?? {};
  const mutationFn: MutationFunction<
    Review,
    { id: number; reviewId: number; data: CreateReplyBody }
  > = ({ id, reviewId, data }) => createReply({ id, reviewId, data }, requestOptions);
  return useMutation({ mutationFn, ...mutationOptions });
};

// ── Flag Review ───────────────────────────────────────────────────────────────

export const flagReview = async (
  { id, reviewId }: { id: number; reviewId: number },
  options?: RequestInit,
): Promise<{ flagged: boolean }> =>
  customFetch<{ flagged: boolean }>(`/api/games/${id}/reviews/${reviewId}/flag`, {
    ...options,
    method: "POST",
  });

export const useFlagReview = <TError = ErrorType<ErrorResponse>, TContext = unknown>(
  options?: {
    mutation?: UseMutationOptions<
      { flagged: boolean },
      TError,
      { id: number; reviewId: number },
      TContext
    >;
    request?: SecondParameter<typeof customFetch>;
  },
): UseMutationResult<{ flagged: boolean }, TError, { id: number; reviewId: number }, TContext> => {
  const { mutation: mutationOptions, request: requestOptions } = options ?? {};
  const mutationFn: MutationFunction<{ flagged: boolean }, { id: number; reviewId: number }> = ({
    id,
    reviewId,
  }) => flagReview({ id, reviewId }, requestOptions);
  return useMutation({ mutationFn, ...mutationOptions });
};
