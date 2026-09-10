import type { Packaging } from "@/features/statistics/types/statistics";

export type { Packaging };

export const NO_PACKAGING: Packaging = { size: null, label: "karobka" };

/**
 * Turns a base-unit count into the language the shelf actually speaks.
 *
 * Quantities are stored in base units (dona) EVERYWHERE in this system — stock,
 * ledger, cart, receipts — which is what keeps the accounting immune to
 * "5 karobka" being typed as "5 dona". The conversion is display-only, and it
 * lives here so an order line, a stock row and a ledger entry phrase it
 * identically instead of leaving reception to divide by nine in their head.
 */

export function hasPackaging(p: Packaging): boolean {
  return p.size !== null && p.size > 1;
}

/**
 * `47` → `5 karobka + 2 dona`; whole boxes and loose-only counts collapse to one
 * term. Unpackaged products fall back to `47 dona`, so this is safe to call
 * unconditionally from any list.
 */
export function formatUnits(p: Packaging, units: number): string {
  if (!hasPackaging(p)) return `${units} dona`;
  const size = p.size as number;
  const packages = Math.trunc(units / size);
  const loose = units % size;
  if (packages === 0) return `${loose} dona`;
  if (loose === 0) return `${packages} ${p.label}`;
  return `${packages} ${p.label} + ${loose} dona`;
}

/**
 * The same breakdown with the base total appended — for detail screens, where
 * "4 karobka + 6 dona (42 dona)" answers both questions at once.
 */
export function formatUnitsVerbose(p: Packaging, units: number): string {
  if (!hasPackaging(p)) return `${units} dona`;
  return `${formatUnits(p, units)} (${units} dona)`;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/**
 * Reads packaging out of any payload that carries it: a full product, a minimal
 * `{id, name, package_size}` embedded in an order line, or the row itself. A
 * backend that doesn't send the fields yet yields {@link NO_PACKAGING} and every
 * caller keeps saying "N dona".
 */
export function parsePackaging(raw: unknown): Packaging {
  if (!isRecord(raw)) return NO_PACKAGING;
  const size = typeof raw.package_size === "number" ? raw.package_size : null;
  const label =
    typeof raw.package_label === "string" && raw.package_label.trim() !== ""
      ? raw.package_label.trim()
      : "karobka";
  return { size, label };
}
