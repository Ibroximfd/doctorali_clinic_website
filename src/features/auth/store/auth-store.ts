"use client";

import { create } from "zustand";

import { ApiError } from "@/shared/lib/api/errors";

import { fetchMe, login as loginRequest } from "../api/auth-api";
import { setUnauthorizedHandler, tokenStorage } from "../lib/token-storage";
import type { AuthUser, UserPermissions } from "../types/auth-user";
import { NO_PERMISSIONS } from "../types/auth-user";

/**
 * `unknown` is the startup state while a stored session is validated — the
 * router must not decide anything until it resolves, or a reload would bounce
 * an authenticated user through `/login`.
 */
export type AuthStatus = "unknown" | "authenticated" | "unauthenticated";

/** Upper bound on the startup `auth/me/` so the splash can never hang. */
const ME_TIMEOUT_MS = 8_000;

interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  /** True while a login submission is in flight. */
  submitting: boolean;
  error: ApiError | null;

  /** Restores and validates a stored session. Safe to call more than once. */
  bootstrap: () => Promise<void>;
  login: (input: {
    username: string;
    password: string;
    remember: boolean;
  }) => Promise<boolean>;
  logout: () => void;
  /** Fired by the HTTP layer when a refresh fails — the session is gone. */
  sessionExpired: () => void;
  clearError: () => void;
}

let bootstrapped = false;

export const useAuthStore = create<AuthState>()((set, get) => ({
  status: "unknown",
  user: null,
  submitting: false,
  error: null,

  async bootstrap() {
    if (bootstrapped) return;
    bootstrapped = true;

    tokenStorage.hydrate();
    // A failed refresh anywhere in the app ends the session.
    setUnauthorizedHandler(() => get().sessionExpired());

    if (!tokenStorage.hasSession) {
      set({ status: "unauthenticated", user: null });
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ME_TIMEOUT_MS);
    try {
      const user = await fetchMe(controller.signal);
      tokenStorage.saveUser(user);
      set({ status: "authenticated", user });
    } catch (error) {
      // Network hiccup but a cached user is on file → stay in. The desk keeps
      // working through a flaky link instead of being thrown out of the panel.
      const cached = tokenStorage.cachedUser;
      if (ApiError.is(error) && error.isNetwork && cached) {
        set({ status: "authenticated", user: cached });
      } else {
        // A timeout is not proof the session is dead — keep the tokens for a
        // later retry, but send the desk to the login screen rather than hang.
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          tokenStorage.clear();
        }
        set({ status: "unauthenticated", user: null });
      }
    } finally {
      clearTimeout(timer);
    }
  },

  async login({ username, password, remember }) {
    set({ submitting: true, error: null });
    try {
      const session = await loginRequest({
        username: username.trim(),
        password,
      });
      tokenStorage.saveSession({ ...session, remember });
      set({ status: "authenticated", user: session.user, submitting: false });
      return true;
    } catch (error) {
      set({
        submitting: false,
        error: ApiError.is(error)
          ? error
          : new ApiError({
              code: "server_error",
              message: "Kutilmagan xatolik yuz berdi. Qayta urinib ko'ring.",
            }),
      });
      return false;
    }
  },

  logout() {
    tokenStorage.clear();
    set({ status: "unauthenticated", user: null, error: null });
  },

  sessionExpired() {
    tokenStorage.clear();
    set({ status: "unauthenticated", user: null });
  },

  clearError() {
    set({ error: null });
  },
}));

// --- Selectors ---------------------------------------------------------------
// Narrow selectors keep a component from re-rendering when an unrelated slice
// of the session changes.

export const selectStatus = (s: AuthState) => s.status;
export const selectUser = (s: AuthState) => s.user;
export const selectPermissions = (s: AuthState): UserPermissions =>
  s.user?.permissions ?? NO_PERMISSIONS;
export const selectIsAdmin = (s: AuthState) => s.user?.isAdmin ?? false;
