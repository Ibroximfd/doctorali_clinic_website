import { percent } from "@/shared/lib/format/percent";

/** A service kind, which decides which commission percentage applies. */
export type TreatmentKind = "treatment" | "consultation";

/**
 * A commission-earning doctor (`doctors/`).
 *
 * `id` is kept as a string (the API sends an integer) and converted back to an
 * int only when building a request body.
 */
export interface Doctor {
  readonly id: string;
  readonly fullName: string;
  readonly specialty: string;
  /** Commission share of a **product sale** total, in percent (e.g. 8–15). */
  readonly commissionPercent: number;
  /** Procedure commission. Null means "use the product percentage". */
  readonly treatmentCommissionPercent: number | null;
  /** Consultation commission. Null falls back to the procedure percentage. */
  readonly consultationCommissionPercent: number | null;
  readonly avatarUrl: string | null;
  readonly isActive: boolean;
}

/** Exact percent, no rounding (e.g. `12%`, `12.5%`, `15.75%`). */
export function commissionLabel(d: Doctor): string {
  return percent.labeled(d.commissionPercent);
}

/**
 * The percentage this doctor earns on a service of `kind` — **only when this
 * record actually carries one**.
 *
 * Null is deliberate and must NOT be replaced by `commissionPercent`. That
 * product rate is a different number entirely (5% on goods where a procedure
 * pays 40%), and `doctors/` does not always serialize the per-kind fields — so
 * substituting it printed "5%" under a procedure the backend paid 40% on, and
 * the desk quoted that figure to the doctor. The chain within the service rates
 * matches the backend's own: consultation → treatment.
 */
export function percentFor(d: Doctor, kind: TreatmentKind): number | null {
  return kind === "consultation"
    ? (d.consultationCommissionPercent ?? d.treatmentCommissionPercent)
    : d.treatmentCommissionPercent;
}

/**
 * Light doctor reference embedded in other objects (debts, treatments, timeline
 * events, appointment summaries). Deliberately smaller than {@link Doctor}:
 * those payloads never carry commission percentages.
 */
export interface DoctorRef {
  readonly id: string;
  readonly fullName: string;
  readonly specialty: string;
  readonly avatarUrl: string | null;
}

function str(v: unknown, fallback = ""): string {
  return v === null || v === undefined ? fallback : String(v);
}
function optNum(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function parseDoctor(raw: unknown): Doctor {
  const d = (raw ?? {}) as Record<string, unknown>;
  return {
    id: str(d.id),
    fullName: str(d.full_name),
    specialty: str(d.specialty),
    commissionPercent: optNum(d.commission_percent) ?? 0,
    treatmentCommissionPercent: optNum(d.treatment_commission_percent),
    consultationCommissionPercent: optNum(d.consultation_commission_percent),
    avatarUrl: imageField(d.avatar_url ?? d.photo ?? d.image_url ?? d.image),
    isActive: d.is_active !== false,
  };
}

export function parseDoctorRef(raw: unknown): DoctorRef {
  const d = (raw ?? {}) as Record<string, unknown>;
  return {
    id: str(d.id),
    fullName: str(d.full_name),
    specialty: str(d.specialty),
    avatarUrl: imageField(d.avatar_url ?? d.photo ?? d.image_url ?? d.image),
  };
}

/**
 * An image field, whichever of its four names this payload happens to use.
 *
 * The client ref has always tolerated the spread; the doctor ref only read
 * `avatar_url`, which is why a doctor could show as initials on a screen where
 * the same doctor had a photo elsewhere.
 */
function imageField(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

export function maybeParseDoctorRef(raw: unknown): DoctorRef | null {
  return typeof raw === "object" && raw !== null ? parseDoctorRef(raw) : null;
}

export function doctorToJson(d: Doctor): Record<string, unknown> {
  return {
    id: d.id,
    full_name: d.fullName,
    specialty: d.specialty,
    commission_percent: d.commissionPercent,
    treatment_commission_percent: d.treatmentCommissionPercent,
    consultation_commission_percent: d.consultationCommissionPercent,
    avatar_url: d.avatarUrl,
    is_active: d.isActive,
  };
}
