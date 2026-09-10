/**
 * Commission percentages — ported from Flutter's `PercentFormatter`.
 *
 * Deliberately does NOT round: the doctor is told this number, and `12.5%`
 * printed as `13%` is a figure the clinic then has to argue about. Only
 * trailing zeros are trimmed.
 */
export const percent = {
  /** `10 → "10"`, `12.5 → "12.5"`, `33.333 → "33.333"`. */
  value(p: number): string {
    if (Number.isInteger(p)) return p.toFixed(0);
    // `String(n)` already yields the shortest round-tripping form.
    return String(p).replace(/0+$/, "").replace(/\.$/, "");
  },

  /** The same, followed by `%`. */
  labeled(p: number): string {
    return `${percent.value(p)}%`;
  },
} as const;
