/**
 * The panel's languages.
 *
 * There is exactly one, and that is a faithful port rather than an omission:
 * the Flutter app shipped Uzbek only, with no localisation library, no language
 * switch and no RTL (MIGRATION_AUDIT.md §7). What `next-intl` buys here is the
 * wiring — a second locale is a file plus one entry in this list, instead of a
 * sweep through every screen.
 */
export const LOCALES = ["uz"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "uz";

/**
 * Tashkent, fixed. The panel is one clinic in one city, and every timestamp in
 * it is already Tashkent wall-clock (see `shared/lib/format/date.ts`), so the
 * formatter must not fall back to the browser's zone.
 */
export const TIME_ZONE = "Asia/Tashkent";
