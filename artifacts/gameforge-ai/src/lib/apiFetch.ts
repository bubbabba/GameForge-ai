/**
 * Thin fetch wrapper that automatically attaches the Clerk bearer token to
 * every request, mirroring what customFetch does for React Query hooks.
 *
 * Use this for any direct fetch() call that hits an authenticated API route
 * (generate-sprite, generate-cover, PATCH game, etc.).
 */
import { getAuthToken } from "@workspace/api-client-react";

export async function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAuthToken().catch(() => null);
  const headers = new Headers(init.headers);
  headers.set("Content-Type", headers.get("Content-Type") ?? "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(url, { ...init, headers });
}
