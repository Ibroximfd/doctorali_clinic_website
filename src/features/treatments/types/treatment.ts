import { maybeParseClientRef, type ClientRef } from "@/features/clients/types/client-ref";
import { maybeParseDebt, type Debt, isDebtOpen } from "@/features/debts/types/debt";
import {
  maybeParseDoctorRef,
  type DoctorRef,
  type TreatmentKind,
} from "@/features/doctors/types/doctor";
import {
  parseOptionalPaymentType,
  parseOrderPayments,
  type OrderPayment,
  type PaymentType,
} from "@/shared/domain/payment-type";
import { percent } from "@/shared/lib/format/percent";
import { tashkentFromApi, type TashkentDate } from "@/shared/lib/format/date";

export type { TreatmentKind };

export const TREATMENT_KINDS = ["treatment", "consultation"] as const;

export function parseTreatmentKind(raw: unknown): TreatmentKind {
  return raw === "consultation" ? "consultation" : "treatment";
}

export const TREATMENT_KIND_LABEL: Readonly<Record<TreatmentKind, string>> = {
  treatment: "Muolaja",
  consultation: "Konsultatsiya",
};

/** There is no "in progress" — reception records a service after the fact. */
export type TreatmentStatus = "completed" | "cancelled";

export function parseTreatmentStatus(raw: unknown): TreatmentStatus {
  return raw === "cancelled" ? "cancelled" : "completed";
}

export const TREATMENT_STATUS_LABEL: Readonly<Record<TreatmentStatus, string>> = {
  completed: "Bajarilgan",
  cancelled: "Bekor qilingan",
};

/**
 * A performed procedure or consultation.
 *
 * `commissionPercent` and `commissionAmount` are the server's snapshot taken at
 * save time. The form shows a live estimate beforehand, but once saved only
 * these values are ever displayed — so a later change to the doctor's
 * percentage can't rewrite history.
 */
export interface Treatment {
  readonly id: string;
  readonly kind: TreatmentKind;
  readonly kindDisplay: string;
  readonly client: ClientRef | null;
  /** Snapshot of the client's name/phone at the time of the service. */
  readonly clientName: string;
  readonly clientPhone: string;
  readonly appointmentId: string | null;
  readonly doctor: DoctorRef | null;
  /**
   * What was done — free text, autocompleted from `treatments/types/` so the
   * same procedure keeps the same wording, which is what makes the services
   * report meaningful.
   */
  readonly description: string;
  readonly amount: number;
  /** What reached the till; `amount − debt` when part went on credit. */
  readonly paidAmount: number;
  /** Null for a mixed payment or a fully credited service. */
  readonly paymentType: PaymentType | null;
  readonly isMixedPayment: boolean;
  readonly payments: readonly OrderPayment[];
  readonly commissionPercent: number;
  readonly commissionAmount: number;
  readonly debt: Debt | null;
  readonly status: TreatmentStatus;
  readonly statusDisplay: string;
  /** Why a cancelled service was cancelled — empty otherwise. */
  readonly cancelReason: string;
  readonly performedAt: TashkentDate;
  readonly createdByName: string;
  readonly createdAt: TashkentDate;
}

export function treatmentKindLabel(t: Treatment): string {
  return t.kindDisplay !== "" ? t.kindDisplay : TREATMENT_KIND_LABEL[t.kind];
}

export function treatmentStatusLabel(t: Treatment): string {
  return t.statusDisplay !== "" ? t.statusDisplay : TREATMENT_STATUS_LABEL[t.status];
}

export function treatmentCommissionLabel(t: Treatment): string {
  return percent.labeled(t.commissionPercent);
}

export function treatmentHasDebt(t: Treatment): boolean {
  return t.debt !== null && isDebtOpen(t.debt.status);
}

/** Name to show in a list; falls back to the embedded card, then the phone. */
export function treatmentClientName(t: Treatment): string {
  const snapshot = t.clientName.trim();
  if (snapshot !== "") return snapshot;
  const card = t.client?.fullName.trim();
  if (card) return card;
  return t.clientPhone;
}

function num(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}
function str(v: unknown, fallback = ""): string {
  return v === null || v === undefined ? fallback : String(v);
}
function fullName(raw: unknown): string {
  return typeof raw === "object" && raw !== null
    ? str((raw as Record<string, unknown>).full_name)
    : "";
}

export function parseTreatment(raw: unknown): Treatment {
  const t = (raw ?? {}) as Record<string, unknown>;
  const rawPaymentType = t.payment_type;

  return {
    id: str(t.id),
    kind: parseTreatmentKind(t.kind),
    kindDisplay: str(t.kind_display),
    client: maybeParseClientRef(t.client),
    clientName: str(t.client_name),
    clientPhone: str(t.client_phone),
    appointmentId:
      t.appointment_id === null || t.appointment_id === undefined
        ? null
        : String(t.appointment_id),
    doctor: maybeParseDoctorRef(t.doctor),
    description: str(t.description),
    amount: num(t.amount),
    paidAmount: num(t.paid_amount),
    // "mixed" and "none" are report-only sentinels, never a selectable type.
    paymentType: parseOptionalPaymentType(rawPaymentType),
    isMixedPayment: rawPaymentType === "mixed",
    payments: parseOrderPayments(t.payments),
    commissionPercent: num(t.commission_percent),
    commissionAmount: num(t.commission_amount),
    debt: maybeParseDebt(t.debt),
    status: parseTreatmentStatus(t.status),
    statusDisplay: str(t.status_display),
    cancelReason: str(t.cancel_reason),
    performedAt: tashkentFromApi(str(t.performed_at)),
    createdByName: fullName(t.created_by),
    createdAt: tashkentFromApi(str(t.created_at)),
  };
}

export function parseTreatmentList(raw: unknown): Treatment[] {
  return Array.isArray(raw)
    ? raw.filter((i) => typeof i === "object" && i !== null).map(parseTreatment)
    : [];
}

/**
 * What `POST treatments/preview/` says a service costs and earns.
 *
 * The commission percentage for a procedure is not the one for goods, and only
 * the server knows which rule applied — so the form asks instead of working it
 * out. Note the backend's rule: the commission is on the **whole** amount, the
 * part written off as credit included.
 */
export interface TreatmentPreview {
  readonly amount: number;
  readonly commissionPercent: number;
  readonly commissionAmount: number;
  /** What reaches the till now: `amount − debtAmount`. */
  readonly paidNow: number;
  readonly debtAmount: number;
}

export function parseTreatmentPreview(raw: unknown): TreatmentPreview {
  const p = (raw ?? {}) as Record<string, unknown>;
  const amount = num(p.amount);
  const debt = num(p.debt_amount);
  return {
    amount,
    commissionPercent: num(p.commission_percent),
    commissionAmount: num(p.commission_amount),
    paidNow: typeof p.paid_now === "number" ? p.paid_now : amount - debt,
    debtAmount: debt,
  };
}

/** KPI block above the treatments page. */
export interface TreatmentSummary {
  readonly totalCount: number;
  readonly totalAmount: number;
  /** What the doctors earned on these services. */
  readonly totalCommission: number;
  readonly treatmentsCount: number;
  readonly treatmentsAmount: number;
  readonly consultationsCount: number;
  readonly consultationsAmount: number;
  /** How much of the period's service revenue is still owed. */
  readonly debtAmount: number;
}

export const EMPTY_TREATMENT_SUMMARY: TreatmentSummary = {
  totalCount: 0,
  totalAmount: 0,
  totalCommission: 0,
  treatmentsCount: 0,
  treatmentsAmount: 0,
  consultationsCount: 0,
  consultationsAmount: 0,
  debtAmount: 0,
};

/** Average service price, 0 when there were none. */
export function averageTreatmentAmount(s: TreatmentSummary): number {
  return s.totalCount === 0 ? 0 : Math.round(s.totalAmount / s.totalCount);
}

/**
 * Backend shape (doc §7.3): `count` / `amount` / `commission` at the top level,
 * with `treatments` and `consultations` as nested `{count, amount}` objects.
 * The flat `total_*` keys are kept as fallbacks for older builds.
 */
export function parseTreatmentSummary(raw: unknown): TreatmentSummary {
  const s = (raw ?? {}) as Record<string, unknown>;
  const nested = (key: string): Record<string, unknown> =>
    typeof s[key] === "object" && s[key] !== null
      ? (s[key] as Record<string, unknown>)
      : {};
  const treatments = nested("treatments");
  const consultations = nested("consultations");

  return {
    totalCount: num(s.count, num(s.total_count)),
    totalAmount: num(s.amount, num(s.total_amount)),
    totalCommission: num(s.commission, num(s.total_commission)),
    treatmentsCount: num(treatments.count, num(s.treatments_count)),
    treatmentsAmount: num(treatments.amount, num(s.treatments_amount)),
    consultationsCount: num(consultations.count, num(s.consultations_count)),
    consultationsAmount: num(consultations.amount, num(s.consultations_amount)),
    debtAmount: num(s.debt_amount),
  };
}
