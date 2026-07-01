import { getAuthToken } from "@workspace/api-client-react";

/**
 * POST to an SSE endpoint, optionally reporting status messages, and return the final result payload.
 *
 * The server sends:
 *   data: {"type":"thinking"}          — keep-alive heartbeat (ignored here)
 *   data: {"type":"result", ...fields} — success (returned)
 *   data: {"type":"error","error":"…"} — failure (thrown)
 *
 * Regular non-SSE JSON error responses (4xx before the stream starts) are
 * also handled: they are thrown as `{ error: string }` objects.
 *
 * Parses SSE per RFC 8895: handles both LF and CRLF line endings,
 * multi-line `data:` concatenation, and comment/event-type lines.
 */
export async function streamPost<T>(
  url: string,
  body: unknown,
  onStatus?: (msg: string) => void,
  signal?: AbortSignal,
  onEvent?: (event: Record<string, unknown>) => void,
): Promise<T> {
  // Attach the Clerk bearer token — same mechanism used by React Query hooks
  const token = await getAuthToken().catch(() => null);
  const authHeader: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err: any) {
    throw { error: err?.message ?? "Network error — could not reach the server." };
  }

  // Non-SSE error response (validation errors, auth failures, etc.)
  if (!res.ok) {
    const payload = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw payload;
  }

  const contentType = res.headers.get("content-type") ?? "";

  // Fallback: plain JSON response (shouldn't happen in normal operation)
  if (!contentType.includes("text/event-stream")) {
    return res.json() as Promise<T>;
  }

  if (!res.body) throw { error: "No response body received." };

  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  // RFC 8895-compliant SSE parser state
  let buffer = "";

  function processEvents(chunk: string): T | null {
    buffer += chunk;

    // Normalise CRLF → LF, then split on double-newline event boundaries
    const normalised = buffer.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const events = normalised.split("\n\n");
    // Keep the last (possibly incomplete) chunk in the buffer
    buffer = events.pop() ?? "";

    for (const event of events) {
      // Collect all `data:` lines and concatenate per spec
      const dataLines: string[] = [];
      for (const line of event.split("\n")) {
        if (line.startsWith(":")) continue;          // SSE comment
        if (line.startsWith("data:")) {
          dataLines.push(line.slice(5).replace(/^ /, ""));
        }
        // We don't use `event:` or `id:` fields, so skip them
      }
      if (dataLines.length === 0) continue;

      const json = dataLines.join("\n");
      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(json);
      } catch {
        continue;
      }

      if (payload.type === "thinking") continue;                 // heartbeat — keep waiting
      if (payload.type === "status" && typeof payload.message === "string") {
        onStatus?.(payload.message);
        continue;
      }
      if (payload.type === "error") throw { error: payload.error };
      if (payload.type === "result") {
        const { type: _t, ...rest } = payload;
        return rest as T;
      }
      // Pass any other typed event to the optional generic callback
      if (payload.type) {
        onEvent?.(payload);
        continue;
      }
    }
    return null;
  }

  while (true) {
    let chunk: ReadableStreamReadResult<Uint8Array>;
    try {
      chunk = await reader.read();
    } catch (err: any) {
      throw { error: "Connection dropped while waiting for AI response. Please try again." };
    }

    const { done, value } = chunk;
    if (done) throw { error: "Stream ended before a result was received. Please try again." };

    const result = processEvents(decoder.decode(value, { stream: true }));
    if (result !== null) return result;
  }
}
