import ky, { type KyInstance, type Options as KyOptions } from "ky";

import { env } from "@/config/env";
import { notifyUnauthorized, tokenStorage } from "@/features/auth/lib/token-storage";

import { AUTH_FREE_PATHS, endpoints } from "./endpoints";
import { ApiError, apiErrorFromBody, networkError } from "./errors";
import { logError, logRequest, logResponse } from "./logging";

/** Query values the API accepts; arrays become repeated `key=` params. */
export type QueryValue =
  string | number | boolean | null | undefined | readonly (string | number)[];
export type Query = Record<string, QueryValue>;

export interface RequestOptions {
  readonly query?: Query;
  /** JSON body. Mutually exclusive with `formData`. */
  readonly json?: unknown;
  readonly formData?: FormData;
  readonly headers?: Record<string, string>;
  readonly signal?: AbortSignal;
}

function isAuthFree(path: string): boolean {
  return AUTH_FREE_PATHS.some((p) => path.includes(p));
}

/**
 * Builds a `URLSearchParams` that drops null/undefined and expands arrays into
 * repeated keys — `tag=vip&tag=yangi`, which is what DRF expects for a
 * multi-value filter.
 */
function buildSearchParams(query: Query | undefined): URLSearchParams | undefined {
  if (!query) return undefined;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined || value === "") continue;
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, String(item));
    } else {
      params.append(key, String(value));
    }
  }
  return params.size === 0 ? undefined : params;
}

// ---------------------------------------------------------------------------
// Single-flight token refresh
// ---------------------------------------------------------------------------

/**
 * The in-flight refresh, if any. Concurrent 401s all await this one promise
 * rather than each firing its own `auth/refresh/` — the single-flight
 * behaviour Flutter got from Dio's `QueuedInterceptor`.
 */
let refreshInFlight: Promise<string> | null = null;

/**
 * A bare client for the refresh call only: it must never re-enter the auth /
 * refresh hooks, or a failing refresh would recurse.
 */
const refreshClient = ky.create({
  baseUrl: env.apiBaseUrl,
  timeout: 20_000,
  retry: 0,
  throwHttpErrors: true,
});

async function performRefresh(): Promise<string> {
  const refresh = tokenStorage.refreshToken;
  if (!refresh) throw new Error("No refresh token");

  const body = await refreshClient
    .post(endpoints.refresh, { json: { refresh } })
    .json<{ access?: string; refresh?: string }>();

  const access = body.access;
  if (!access) throw new Error("No access token in refresh response");

  // Store the new access token and any rotated refresh token.
  tokenStorage.saveTokens(access, body.refresh ?? null);
  return access;
}

/** Refreshes at most once at a time; every caller gets the same result. */
function refreshAccessToken(): Promise<string> {
  refreshInFlight ??= performRefresh().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function failSession(): Promise<void> {
  tokenStorage.clear();
  notifyUnauthorized();
}

// ---------------------------------------------------------------------------
// The client
// ---------------------------------------------------------------------------

const client: KyInstance = ky.create({
  baseUrl: env.apiBaseUrl,
  // The reception API is behind a slow link at the desk; 20s matches the
  // Flutter receive timeout. A hung request is worse than a clear failure.
  timeout: 20_000,
  // Retrying is decided per-call (only the 401 → refresh path retries), never
  // blindly: replaying a POST would risk a duplicate order.
  retry: 0,
  // Errors are mapped from the body by `request`, so ky must not throw first.
  throwHttpErrors: false,
});

/**
 * One API call, with the auth header, the 401→refresh→retry dance and the
 * uniform error mapping applied.
 *
 * `parse` turns the raw `Response` into `T`. It is a parameter rather than a
 * hardcoded `.json()` so the binary export endpoints share this exact path —
 * including the refresh — instead of hand-rolling a second client.
 */
async function request<T>(
  path: string,
  method: "get" | "post" | "patch" | "put" | "delete",
  options: RequestOptions | undefined,
  parse: (response: Response) => Promise<T>,
): Promise<T> {
  const searchParams = buildSearchParams(options?.query);
  const authFree = isAuthFree(path);

  const send = async (token: string | null): Promise<Response> => {
    const headers: Record<string, string> = { ...options?.headers };
    if (!authFree && token) headers.Authorization = `Bearer ${token}`;

    const kyOptions: KyOptions = {
      method,
      searchParams,
      headers,
      signal: options?.signal,
    };
    if (options?.formData) kyOptions.body = options.formData;
    else if (options?.json !== undefined) kyOptions.json = options.json;

    logRequest(method, path, searchParams, headers, options?.json);
    return client(path, kyOptions);
  };

  let usedToken = authFree ? null : tokenStorage.accessToken;
  let response: Response;

  try {
    response = await send(usedToken);
  } catch (error) {
    // No HTTP response at all — offline, DNS, timeout, or a blocked CORS
    // preflight (which the browser reports as a plain network failure).
    // A cancelled request (the desk changed the filter before the answer came)
    // is routine, not a failure — it must not paint a red CORS warning.
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    logError(method, path, error);
    warnAboutCorsOnce(path);
    throw networkError();
  }

  if (response.status === 401 && !authFree) {
    const current = tokenStorage.accessToken;
    if (current && current !== usedToken) {
      // A concurrent request already refreshed — just replay with the new token.
      usedToken = current;
      response = await send(current);
    } else if (tokenStorage.refreshToken) {
      try {
        const fresh = await refreshAccessToken();
        response = await send(fresh);
      } catch {
        await failSession();
        // Fall through: the original 401 body is what the caller should see.
      }
    } else {
      await failSession();
    }
  }

  if (!response.ok) {
    const body = await readBodySafely(response);
    logResponse(method, path, response.status, body);
    throw apiErrorFromBody(response.status, body);
  }

  const parsed = await parse(response);
  logResponse(method, path, response.status, parsed);
  return parsed;
}

/** A failure body may be JSON, HTML from a proxy, or empty. Never throw here. */
async function readBodySafely(response: Response): Promise<unknown> {
  try {
    const text = await response.text();
    if (text === "") return null;
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  } catch {
    return null;
  }
}

/** `204 No Content` is a normal success for DELETE — `.json()` would throw. */
async function parseJsonOrNull<T>(response: Response): Promise<T> {
  if (response.status === 204) return null as T;
  const text = await response.text();
  if (text === "") return null as T;
  return JSON.parse(text) as T;
}

let corsWarned = false;

/**
 * On web, a blocked CORS preflight is indistinguishable from being offline. Log
 * the exact origin once so it can be forwarded to the backend team for
 * whitelisting — no in-app proxy hacks.
 */
function warnAboutCorsOnce(path: string): void {
  if (corsWarned || typeof window === "undefined") return;
  corsWarned = true;
  console.warn(
    `🟥 Network/CORS failure on "${path}". If this is CORS, the browser blocked ` +
      `origin "${window.location.origin}" — the backend must add it to ` +
      `CORS_ALLOWED_ORIGINS (and allow the Authorization header).`,
  );
}

export const http = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, "get", options, parseJsonOrNull),
  post: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, "post", options, parseJsonOrNull),
  patch: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, "patch", options, parseJsonOrNull),
  put: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, "put", options, parseJsonOrNull),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, "delete", options, parseJsonOrNull),

  /**
   * Downloads a binary export (`.xlsx` / `.pdf`) through the same authenticated
   * path — so a 401 still refreshes and retries, and the filename comes from
   * the server's `Content-Disposition`.
   */
  blob: (path: string, options: RequestOptions & { fallbackFileName: string }) =>
    request(path, "get", options, async (response) => ({
      blob: await response.blob(),
      fileName: fileNameFrom(
        response.headers.get("content-disposition"),
        options.fallbackFileName,
      ),
    })),
} as const;

/** Extracts `filename="…"` from a Content-Disposition header. */
export function fileNameFrom(disposition: string | null, fallback: string): string {
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition ?? "");
  const name = match?.[1]?.trim();
  return name && name !== "" ? decodeURIComponent(name) : fallback;
}

export { ApiError };
