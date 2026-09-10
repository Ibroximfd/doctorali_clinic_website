/**
 * UZS money formatting — ported from Flutter's `MoneyFormatter`.
 *
 * Amounts are whole so'm integers everywhere in this system (the API never
 * sends fractions), grouped with a SPACE rather than a comma, because that is
 * how the desk reads them and how the receipt prints them.
 */

/** `1250000` → `1 250 000`. Negative values keep a leading minus. */
function group(value: number): string {
  const rounded = Math.round(value);
  const digits = Math.abs(rounded).toString();
  let out = "";
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += " ";
    out += digits[i];
  }
  return (rounded < 0 ? "-" : "") + out;
}

export const money = {
  /** `1 250 000 so'm` — the full form, for totals and detail rows. */
  uzs(value: number): string {
    return `${group(value)} so'm`;
  },

  /** `1 250 000` — no suffix, for table cells where the column says so'm. */
  plain(value: number): string {
    return group(value);
  },

  /**
   * `1.2 mln` / `850 ming` — for chart axis labels and KPI deltas, where the
   * exact figure would not fit and is not the point.
   */
  compact(value: number): string {
    const abs = Math.abs(value);
    const sign = value < 0 ? "-" : "";
    if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(1)} mlrd`;
    if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)} mln`;
    if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(0)} ming`;
    return `${sign}${Math.round(abs)}`;
  },

  /** `+1 250 000` / `−340 000` — signed, for adjustments and difference columns. */
  signed(value: number): string {
    if (value === 0) return group(0);
    return value > 0 ? `+${group(value)}` : `−${group(Math.abs(value))}`;
  },
} as const;

/**
 * Groups digits while they are being typed: `200000` → `200 000`.
 * Ported from `MoneyInputFormatter`. Input must already be digits only.
 */
export function groupDigits(digits: string): string {
  let out = "";
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += " ";
    out += digits[i];
  }
  return out;
}

/** Enough for 999 milliard so'm — anything longer is a typo, so it is refused. */
export const MAX_MONEY_DIGITS = 12;

/**
 * The money-input transform: keeps only digits, drops leading zeros, caps the
 * length and regroups. Returns `null` when the edit must be rejected (too many
 * digits), matching the Flutter formatter's "keep the old value" behaviour.
 */
export function formatMoneyInput(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 0) return "";
  if (digits.length > MAX_MONEY_DIGITS) return null;
  return groupDigits(digits.replace(/^0+(?=\d)/, ""));
}

/** Reads a grouped money string back to an integer; `0` when empty. */
export function parseMoney(text: string): number {
  const digits = text.replace(/\D/g, "");
  return digits === "" ? 0 : Number.parseInt(digits, 10);
}

/** Grouped text for an amount; empty for zero so a placeholder stays visible. */
export function moneyInputValue(amount: number): string {
  return amount > 0 ? groupDigits(String(amount)) : "";
}
