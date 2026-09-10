import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";

import { AppProviders } from "@/shared/components/providers/app-providers";
import { ThemeScript } from "@/shared/components/providers/theme-script";

import "./globals.css";

/**
 * Plus Jakarta Sans, self-hosted by `next/font`.
 *
 * The Flutter build fetched this family from Google Fonts at runtime, so the
 * first launch of every session flashed a fallback face. Here the subset ships
 * with the app and is preloaded — the flash is gone.
 */
const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Doctor Ali — Qabulxona",
    template: "%s · Doctor Ali",
  },
  description: "Doctor Ali klinikasi qabulxonasi uchun boshqaruv paneli.",
  applicationName: "Doctor Ali — Qabulxona",
  /**
   * This is an internal panel holding client records, debts, till figures and
   * staff data. It must never be indexed — see MIGRATION_AUDIT.md §0.
   */
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
  icons: { icon: "/favicon.png", apple: "/icons/icon-192.png" },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#2E9E6B" },
    { media: "(prefers-color-scheme: dark)", color: "#10150F" },
  ],
  width: "device-width",
  initialScale: 1,
  // The desk zooms in to read a phone number off a small screen; never block it.
  maximumScale: 5,
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);

  return (
    <html lang={locale} className={plusJakarta.variable} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <AppProviders>{children}</AppProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
