"use client";

import { create } from "zustand";

/**
 * Light / dark selection — ported from Flutter's `ThemeBloc` + `ThemeStorage`.
 *
 * **Defaults to light, not to the OS setting.** The Flutter panel never
 * followed `prefers-color-scheme`, and reception's screens are bright rooms;
 * silently flipping the panel dark because a laptop is in dark mode would be a
 * behaviour change, not a port.
 */
export type ThemeMode = "light" | "dark";

const STORAGE_KEY = "theme_mode";

function readStored(): ThemeMode {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function applyToDocument(mode: ThemeMode): void {
  document.documentElement.classList.toggle("dark", mode === "dark");
}

interface ThemeState {
  mode: ThemeMode;
  /** Adopts the stored mode. Called once on mount, after hydration. */
  hydrate: () => void;
  toggle: () => void;
  setMode: (mode: ThemeMode) => void;
}

export const useThemeStore = create<ThemeState>()((set, get) => ({
  mode: "light",

  hydrate() {
    const mode = readStored();
    applyToDocument(mode);
    set({ mode });
  },

  toggle() {
    get().setMode(get().mode === "dark" ? "light" : "dark");
  },

  setMode(mode) {
    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* A theme that cannot be persisted still applies for this tab. */
    }
    applyToDocument(mode);
    set({ mode });
  },
}));
