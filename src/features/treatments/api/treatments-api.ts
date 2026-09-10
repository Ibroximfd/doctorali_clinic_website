import { debtDraftToJson, type DebtDraft } from "@/features/debts/types/debt";
import { toApiRange, type DateRange } from "@/shared/domain/date-range";
import {
  orderPaymentToJson,
  type OrderPayment,
  type PaymentType,
} from "@/shared/domain/payment-type";
import {
  CONFIRM_PIN_HEADER,
  IDEMPOTENCY_HEADER,
  endpoints,
} from "@/shared/lib/api/endpoints";
import { ApiError } from "@/shared/lib/api/errors";
import { http, type Query } from "@/shared/lib/api/http";
import { parsePaginated, type Paginated } from "@/shared/lib/api/pagination";
import { toApiIso, type TashkentDate } from "@/shared/lib/format/date";
import { uuidV4 } from "@/shared/lib/uuid";

import {
  parseTreatment,
  parseTreatmentPreview,
  parseTreatmentSummary,
  type Treatment,
  type TreatmentKind,
  type TreatmentPreview,
  type TreatmentStatus,
  type TreatmentSummary,
} from "../types/treatment";

export interface TreatmentFilter {
  readonly range?: DateRange | null;
  readonly doctorId?: string | null;
  readonly kind?: TreatmentKind | null;
  readonly status?: TreatmentStatus | null;
  readonly clientId?: number | null;
  readonly hasDebt?: boolean | null;
  /** Services whose money reached one particular till. */
  readonly paymentType?: PaymentType | null;
  /** Client name / phone / description. */
  readonly search?: string;
  readonly ordering?: string;
}

export const DEFAULT_TREATMENT_FILTER: TreatmentFilter = {
  ordering: "-performed_at",
};

export function treatmentFilterQuery(filter: TreatmentFilter): Query {
  return {
    ...(filter.range ? toApiRange(filter.range) : {}),
    ...(filter.doctorId ? { doctor_id: filter.doctorId } : {}),
    ...(filter.kind ? { kind: filter.kind } : {}),
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.clientId ? { client_id: filter.clientId } : {}),
    ...(filter.hasDebt !== null && filter.hasDebt !== undefined
      ? { has_debt: String(filter.hasDebt) }
      : {}),
    ...(filter.paymentType ? { payment_type: filter.paymentType } : {}),
    ...(filter.search?.trim() ? { search: filter.search.trim() } : {}),
    ordering: filter.ordering ?? "-performed_at",
  };
}

export function treatmentFilterKey(filter: TreatmentFilter): readonly unknown[] {
  return [
    filter.range?.start.getTime() ?? null,
    filter.range?.end.getTime() ?? null,
    filter.doctorId ?? null,
    filter.kind ?? null,
    filter.status ?? null,
    filter.clientId ?? null,
    filter.hasDebt ?? null,
    filter.paymentType ?? null,
    filter.search?.trim() ?? "",
    filter.ordering ?? "-performed_at",
  ];
}

export function fetchTreatments(input: {
  filter: TreatmentFilter;
  page?: number;
  signal?: AbortSignal;
}): Promise<Paginated<Treatment>> {
  return http
    .get<unknown>(endpoints.treatments, {
      query: { page: input.page ?? 1, ...treatmentFilterQuery(input.filter) },
      signal: input.signal,
    })
    .then((raw) => parsePaginated(raw as never, parseTreatment));
}

export function fetchTreatmentSummary(
  filter: TreatmentFilter,
  signal?: AbortSignal,
): Promise<TreatmentSummary> {
  return http
    .get<unknown>(endpoints.treatmentsSummary, {
      query: treatmentFilterQuery(filter),
      signal,
    })
    .then(parseTreatmentSummary);
}

/**
 * `GET treatments/types/` — the descriptions used most over the last six months.
 *
 * Not a convenience: when the same procedure is typed five different ways the
 * services report becomes meaningless, and autocomplete is what keeps the
 * wording consistent. A failure here must never stop reception from recording a
 * service, so it degrades to an empty list.
 */
export async function fetchTreatmentTypes(signal?: AbortSignal): Promise<string[]> {
  try {
    const data = await http.get<unknown>(endpoints.treatmentTypes, { signal });
    const results = Array.isArray(data)
      ? data
      : typeof data === "object" && data !== null
        ? (((data as Record<string, unknown>).results as unknown[] | undefined) ?? [])
        : [];
    return results
      .map((item) => (item === null || item === undefined ? "" : String(item).trim()))
      .filter((item) => item !== "");
  } catch (error) {
    if (ApiError.is(error)) return [];
    throw error;
  }
}

/**
 * `POST treatments/preview/` — the server's own commission for this service
 * before it is saved, so the form never applies a percentage itself.
 */
export function previewTreatment(input: {
  kind: TreatmentKind;
  doctorId: string;
  amount: number;
  debt?: DebtDraft | null;
  signal?: AbortSignal;
}): Promise<TreatmentPreview> {
  return http
    .post<unknown>(endpoints.treatmentsPreview, {
      json: {
        kind: input.kind,
        doctor_id: Number.parseInt(input.doctorId, 10),
        amount: input.amount,
        ...(input.debt ? { debt: debtDraftToJson(input.debt) } : {}),
      },
      signal: input.signal,
    })
    .then(parseTreatmentPreview);
}

export interface CreateTreatmentInput {
  readonly kind: TreatmentKind;
  /** API phone value `998XXXXXXXXX`. */
  readonly clientPhone: string;
  readonly clientName: string;
  /** Mandatory — a service always belongs to a doctor; the commission must land. */
  readonly doctorId: string;
  readonly amount: number;
  readonly description?: string;
  /**
   * Null on a service that takes no money now and was left unmarked — the body
   * then carries `payment_type: "none"`. Reception may still mark a type on
   * such a service, and that choice is sent instead.
   */
  readonly paymentType: PaymentType | null;
  readonly payments?: readonly OrderPayment[] | null;
  readonly debt?: DebtDraft | null;
  readonly performedAt?: TashkentDate | null;
  readonly appointmentId?: string | null;
  /** Verified PIN, required when `performedAt` falls on an earlier day. */
  readonly confirmPin?: string | null;
  readonly idempotencyKey?: string;
}

export function createTreatment(input: CreateTreatmentInput): Promise<Treatment> {
  const credited = input.debt?.amount ?? 0;
  const paidNow = Math.max(0, input.amount - credited);
  const split = input.payments && input.payments.length > 0 ? input.payments : null;

  return http
    .post<Record<string, unknown>>(endpoints.treatments, {
      json: {
        kind: input.kind,
        client_phone: input.clientPhone,
        ...(input.clientName.trim() ? { client_name: input.clientName.trim() } : {}),
        doctor_id: Number.parseInt(input.doctorId, 10),
        amount: input.amount,
        ...(input.description?.trim() ? { description: input.description.trim() } : {}),
        // §5.2: nothing changes hands when the whole service went on credit —
        // the contract wants an explicit `payment_type`, not silence, and NO
        // payments at all. "none" unless the desk marked how it wants it booked.
        ...(paidNow === 0
          ? { payment_type: input.paymentType ?? "none" }
          : split
            ? { payments: split.map(orderPaymentToJson) }
            : input.paymentType
              ? { payment_type: input.paymentType }
              : {}),
        ...(input.debt ? { debt: debtDraftToJson(input.debt) } : {}),
        ...(input.performedAt ? { performed_at: toApiIso(input.performedAt) } : {}),
        ...(input.appointmentId ? { appointment_id: input.appointmentId } : {}),
      },
      headers: {
        // Same key across retries of one submission, so a dropped connection
        // can't record the same service (and its commission) twice.
        [IDEMPOTENCY_HEADER]: input.idempotencyKey ?? uuidV4(),
        ...(input.confirmPin ? { [CONFIRM_PIN_HEADER]: input.confirmPin } : {}),
      },
    })
    .then((data) => parseTreatment(unwrap(data)));
}

/**
 * `PATCH treatments/{id}/`.
 *
 * Changing the amount or the doctor makes the backend recompute the commission;
 * it refuses outright once that commission has been paid out. Editing a service
 * from an earlier day needs `confirmPin`.
 */
export function updateTreatment(
  id: string,
  patch: {
    amount?: number;
    doctorId?: string;
    description?: string;
    performedAt?: TashkentDate;
    confirmPin?: string | null;
  },
): Promise<Treatment> {
  return http
    .patch<Record<string, unknown>>(endpoints.treatment(id), {
      json: {
        ...(patch.amount !== undefined ? { amount: patch.amount } : {}),
        ...(patch.doctorId ? { doctor_id: Number.parseInt(patch.doctorId, 10) } : {}),
        ...(patch.description !== undefined
          ? { description: patch.description.trim() }
          : {}),
        ...(patch.performedAt ? { performed_at: toApiIso(patch.performedAt) } : {}),
      },
      headers: patch.confirmPin ? { [CONFIRM_PIN_HEADER]: patch.confirmPin } : undefined,
    })
    .then((data) => parseTreatment(unwrap(data)));
}

/** `POST treatments/{id}/cancel/` — the reason is recorded in the audit log. */
export function cancelTreatment(
  id: string,
  input: { reason: string; confirmPin?: string | null },
): Promise<Treatment> {
  return http
    .post<Record<string, unknown>>(endpoints.treatmentCancel(id), {
      json: { reason: input.reason.trim() },
      headers: input.confirmPin ? { [CONFIRM_PIN_HEADER]: input.confirmPin } : undefined,
    })
    .then((data) => parseTreatment(unwrap(data)));
}

/**
 * `DELETE treatments/{id}/` — removes the record outright.
 *
 * A cancel keeps the line in the history as cancelled; a delete leaves no trace
 * in the lists or the reports, so it is for entries that should never have
 * existed. Always audited by `reason` and gated by the PIN.
 */
export function deleteTreatment(
  id: string,
  input: { reason: string; confirmPin: string },
): Promise<void> {
  return http.delete<void>(endpoints.treatment(id), {
    json: { reason: input.reason.trim() },
    headers: { [CONFIRM_PIN_HEADER]: input.confirmPin },
  });
}

/** Tolerates either a bare treatment or one wrapped as `{ "treatment": {…} }`. */
function unwrap(data: Record<string, unknown> | null): unknown {
  if (!data) return {};
  const nested = data.treatment;
  return typeof nested === "object" && nested !== null ? nested : data;
}
