/**
 * Verbose, easy-to-spot API logging — the console banner ported from Flutter's
 * `LoggingInterceptor`.
 *
 * Gated on `env.apiLogging`, which is on in development and can be turned on in
 * a production build with `NEXT_PUBLIC_API_LOGGING=true`. This is how a failing
 * request at the desk is diagnosed from a screenshot of DevTools, so the
 * request, the response and the server's error payload all get printed.
 *
 * The Authorization header is always redacted.
 */
/* eslint-disable no-console -- the console IS the feature here. */
import { env } from "@/config/env";

const MAX_BODY_CHARS = 4000;

function pretty(data: unknown): string {
  let out: string;
  try {
    out = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  } catch {
    out = String(data);
  }
  if (out === undefined) return "undefined";
  return out.length > MAX_BODY_CHARS
    ? `${out.slice(0, MAX_BODY_CHARS)}\n… (qisqartirildi)`
    : out;
}

function redact(headers: Record<string, string>): Record<string, string> {
  const copy = { ...headers };
  if (copy.Authorization) copy.Authorization = "Bearer ***";
  return copy;
}

function line(method: string, path: string, search?: URLSearchParams): string {
  const query = search && search.size > 0 ? `?${search.toString()}` : "";
  return `${method.toUpperCase()}  ${env.apiBaseUrl}${path}${query}`;
}

export function logRequest(
  method: string,
  path: string,
  search: URLSearchParams | undefined,
  headers: Record<string, string>,
  body: unknown,
): void {
  if (!env.apiLogging) return;
  console.groupCollapsed(`🟦 ➡️ API REQUEST — ${line(method, path, search)}`);
  console.log("Headers:", redact(headers));
  if (body !== undefined) console.log("Body:", pretty(body));
  console.groupEnd();
}

export function logResponse(
  method: string,
  path: string,
  status: number,
  data: unknown,
): void {
  if (!env.apiLogging) return;
  const ok = status >= 200 && status < 400;
  const badge = ok ? "🟩 ✅" : "🟥 ❌";
  console.groupCollapsed(`${badge} API RESPONSE ${status} — ${line(method, path)}`);
  console.log("Data:", typeof data === "string" ? data : pretty(data));
  console.groupEnd();
}

export function logError(method: string, path: string, error: unknown): void {
  if (!env.apiLogging) return;
  console.groupCollapsed(`🟥 ❌ API ERROR — ${line(method, path)}`);
  console.log("Error:", error);
  console.groupEnd();
}
