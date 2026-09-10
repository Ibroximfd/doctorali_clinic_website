"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { AppRoutes } from "@/config/routes";
import { SplashScreen } from "@/shared/components/feedback/splash-screen";

import { useAuthStore } from "../store/auth-store";

/**
 * The client-side authority on the session (the middleware's cookie is only a
 * hint — see `middleware.ts`).
 *
 * Three states, and the third is the one that matters: while the stored session
 * is being validated the status is `unknown`, and NOTHING may be decided —
 * rendering the panel would flash private data, and redirecting to `/login`
 * would bounce a signed-in user out on every reload.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const status = useAuthStore((s) => s.status);
  const bootstrap = useAuthStore((s) => s.bootstrap);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (status !== "unauthenticated") return;
    // Carry the destination so login can return them there afterwards.
    const from = `${window.location.pathname}${window.location.search}`;
    const target =
      from === AppRoutes.login || from === "/"
        ? AppRoutes.login
        : `${AppRoutes.login}?from=${encodeURIComponent(from)}`;
    router.replace(target);
  }, [status, router]);

  if (status !== "authenticated") return <SplashScreen />;
  return <>{children}</>;
}

/**
 * The mirror image, for `/login`: once a session exists, leave the login screen
 * and restore whatever page the visitor was originally heading for.
 *
 * Unlike `AuthGate` it renders its children immediately, including while the
 * stored session is still being validated. There is nothing private on a login
 * screen, and holding it back behind a splash is what made the form arrive a
 * second and a half after the page did — the form is server-rendered instead,
 * and a visitor who turns out to be signed in is redirected a moment later.
 *
 * `from` is read from `window.location` rather than `useSearchParams`, because
 * that hook opts the whole subtree out of server rendering, which is precisely
 * what this is avoiding.
 */
export function GuestGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const status = useAuthStore((s) => s.status);
  const bootstrap = useAuthStore((s) => s.bootstrap);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (status !== "authenticated") return;
    const from = new URLSearchParams(window.location.search).get("from");
    const target =
      from && from.startsWith("/") && from !== AppRoutes.login
        ? from
        : AppRoutes.dashboard;
    router.replace(target);
  }, [status, router]);

  return <>{children}</>;
}
