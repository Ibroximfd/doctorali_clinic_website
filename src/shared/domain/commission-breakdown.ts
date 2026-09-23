import { money } from "@/shared/lib/format/money";

/**
 * How one commission figure is made up (`commission_breakdown`).
 *
 * The backend guarantees `products + treatments + adjustments === total`, so
 * nothing here re-adds the parts: the figure printed next to a breakdown is the
 * server's own `total`. Recomputing it on the client is exactly how the two
 * stop agreeing, which is the argument this whole payload exists to end.
 */
export interface CommissionBreakdown {
  /** Commission from product sales — desk, app and doctor-created orders. */
  readonly products: number;
  /** Commission from procedures and consultations. */
  readonly treatments: number;
  /**
   * Corrections booked against the week — a return, an edited order. Negative
   * is the normal case: money coming off what the doctor is owed.
   */
  readonly adjustments: number;
  readonly total: number;
}

/**
 * Null when the payload carries no breakdown at all.
 *
 * A missing object is NOT an all-zero one: printing "Muolaja 0" for a server
 * that simply does not send the field yet would tell the desk the doctor earned
 * nothing on procedures, so the screens leave the line out instead.
 */
export function parseCommissionBreakdown(raw: unknown): CommissionBreakdown | null {
  if (typeof raw !== "object" || raw === null) return null;
  const b = raw as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  return {
    products: num(b.products),
    treatments: num(b.treatments),
    adjustments: num(b.adjustments),
    total: num(b.total),
  };
}

export type CommissionSegmentKey = "products" | "treatments" | "adjustments";

export interface CommissionSegment {
  readonly key: CommissionSegmentKey;
  readonly label: string;
  readonly amount: number;
}

const SEGMENT_LABEL: Readonly<Record<CommissionSegmentKey, string>> = {
  products: "Mahsulot",
  treatments: "Muolaja",
  adjustments: "Tuzatish",
};

/** The parts worth printing, in the order the desk reads them. */
export function breakdownSegments(b: CommissionBreakdown): readonly CommissionSegment[] {
  const keys: readonly CommissionSegmentKey[] = ["products", "treatments", "adjustments"];
  return keys
    .filter((key) => b[key] !== 0)
    .map((key) => ({ key, label: SEGMENT_LABEL[key], amount: b[key] }));
}

/**
 * Whether the split says anything the total does not.
 *
 * One part alone repeats the figure it sits under, so it is noise on a dense
 * list — with one exception: a correction is always worth naming, because a
 * week that came out lower than the doctor expected is the one thing the desk
 * gets asked about.
 */
export function isBreakdownInformative(b: CommissionBreakdown): boolean {
  return breakdownSegments(b).length >= 2 || b.adjustments !== 0;
}

/** The same split as one plain line, for a KPI tile's `hint`. */
export function breakdownHint(b: CommissionBreakdown | null): string | undefined {
  if (b === null || !isBreakdownInformative(b)) return undefined;
  return breakdownSegments(b)
    .map((segment) => `${segment.label} ${segmentAmount(segment)}`)
    .join(" · ");
}

/** Corrections keep their sign; everything else is a plain figure. */
export function segmentAmount(segment: CommissionSegment): string {
  return segment.amount < 0 ? money.signed(segment.amount) : money.plain(segment.amount);
}
