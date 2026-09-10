import { BrandMark } from "@/shared/components/layout/brand-mark";

/**
 * Shown while a stored session is validated on start-up. Deliberately quiet: it
 * is on screen for well under a second on a warm session, and a spinner that
 * announces itself would make the panel feel slower than it is.
 */
export function SplashScreen() {
  return (
    <div
      className="bg-background flex h-dvh flex-col items-center justify-center gap-5"
      role="status"
      aria-live="polite"
    >
      <BrandMark size={64} radius="rounded-lg" />
      <div
        className="border-border border-t-primary size-7 animate-spin rounded-full border-[2.6px]"
        aria-hidden
      />
      <span className="sr-only">Yuklanmoqda…</span>
    </div>
  );
}
