/**
 * The session store — ported from Flutter's `TokenStorage`.
 *
 * Two persistence modes, chosen at login by the "Meni eslab qolish" checkbox:
 *
 *   • remember = true  → tokens and the user live in `localStorage` and survive
 *     a browser restart. This is what keeps the desk signed in day to day.
 *   • remember = false → they live in module memory only and are lost the
 *     moment the tab closes. NOTHING is written to `localStorage`.
 *
 * The raw password is never stored — only tokens and the user object.
 *
 * Deliberately a plain module rather than a React store: the HTTP client's
 * refresh hook needs the tokens outside of any component tree, and the Zustand
 * auth store reads and writes through here so both always agree.
 */

import type { AuthUser } from "../types/auth-user";

const K_ACCESS = "auth_access";
const K_REFRESH = "auth_refresh";
const K_USER = "auth_user";

let memAccess: string | null = null;
let memRefresh: string | null = null;
let memUser: string | null = null;

/**
 * Only a persisted session can survive a fresh page load, so the mode is
 * adopted from whatever is on disk at boot.
 */
let remember = true;

/** `localStorage` throws in a private window or when site data is blocked. */
function safeGet(key: string): string | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(key, value);
  } catch {
    /* A session that cannot be persisted still works for this tab. */
  }
}

function safeRemove(key: string): void {
  try {
    if (typeof window !== "undefined") window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/**
 * A NON-credential hint cookie so `middleware.ts` can redirect an
 * unauthenticated visitor server-side instead of letting the page flash before
 * the client gate runs.
 *
 * It carries no token and grants nothing: the real session lives in
 * `localStorage` (or memory), and the client gate is what actually decides. Its
 * lifetime mirrors the chosen persistence mode — a session cookie when
 * "Meni eslab qolish" is unchecked, so closing the tab forgets both halves.
 */
const SESSION_HINT_COOKIE = "da_session";

function writeSessionHint(persist: boolean): void {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  const age = persist ? "; Max-Age=2592000" : "";
  document.cookie = `${SESSION_HINT_COOKIE}=1; Path=/; SameSite=Lax${age}${secure}`;
}

function clearSessionHint(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${SESSION_HINT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

function clearMemory(): void {
  memAccess = null;
  memRefresh = null;
  memUser = null;
}

function clearPersisted(): void {
  safeRemove(K_ACCESS);
  safeRemove(K_REFRESH);
  safeRemove(K_USER);
}

export const tokenStorage = {
  /** Adopts the persisted mode. Called once, client-side, before the first request. */
  hydrate(): void {
    remember = (safeGet(K_ACCESS) ?? "") !== "";
    // Re-assert the hint: an in-memory session has none yet, and a persisted
    // one may have outlived its cookie.
    if (this.hasSession) writeSessionHint(remember);
    else clearSessionHint();
  },

  get rememberMe(): boolean {
    return remember;
  },

  get accessToken(): string | null {
    return memAccess ?? safeGet(K_ACCESS);
  },

  get refreshToken(): string | null {
    return memRefresh ?? safeGet(K_REFRESH);
  },

  /** True when a session — persisted or in-memory — is present. */
  get hasSession(): boolean {
    return Boolean(this.accessToken) && Boolean(this.refreshToken);
  },

  /** The cached user from a previous session, or null when unreadable. */
  get cachedUser(): AuthUser | null {
    const raw = memUser ?? safeGet(K_USER);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  },

  /** Stores a full session on login. `remember` selects the persistence mode. */
  saveSession(session: {
    access: string;
    refresh: string;
    user: AuthUser;
    remember: boolean;
  }): void {
    remember = session.remember;
    const userJson = JSON.stringify(session.user);
    if (session.remember) {
      clearMemory();
      safeSet(K_ACCESS, session.access);
      safeSet(K_REFRESH, session.refresh);
      safeSet(K_USER, userJson);
    } else {
      clearPersisted();
      memAccess = session.access;
      memRefresh = session.refresh;
      memUser = userJson;
    }
    writeSessionHint(session.remember);
  },

  /** Updates tokens after a refresh, writing to whichever mode is active. */
  saveTokens(access: string, refresh?: string | null): void {
    if (remember) {
      safeSet(K_ACCESS, access);
      if (refresh) safeSet(K_REFRESH, refresh);
    } else {
      memAccess = access;
      if (refresh) memRefresh = refresh;
    }
  },

  /** Updates the cached user (e.g. after `auth/me/`), in the current mode. */
  saveUser(user: AuthUser): void {
    const json = JSON.stringify(user);
    if (remember) safeSet(K_USER, json);
    else memUser = json;
  },

  clear(): void {
    clearMemory();
    clearPersisted();
    clearSessionHint();
  },
} as const;

/**
 * Called when the session is irrecoverable (a refresh failed). Wired by the app
 * root to log out and send the desk back to `/login`.
 */
let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

export function notifyUnauthorized(): void {
  onUnauthorized?.();
}
