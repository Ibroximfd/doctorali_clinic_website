import { maybeParseClientRef, type ClientRef } from "@/features/clients/types/client-ref";
import { maybeParseDoctorRef, type DoctorRef } from "@/features/doctors/types/doctor";
import {
  maybeTashkentFromApi,
  tashkentFromApi,
  type TashkentDate,
} from "@/shared/lib/format/date";
import { parseFilialRef, type FilialRef } from "@/shared/domain/filial";

/** Why the client is coming in. */
export const APPOINTMENT_PURPOSES = [
  "product",
  "treatment",
  "consultation",
  "checkup",
  "other",
] as const;
export type AppointmentPurpose = (typeof APPOINTMENT_PURPOSES)[number];

export function parsePurpose(raw: unknown): AppointmentPurpose {
  return APPOINTMENT_PURPOSES.includes(raw as AppointmentPurpose)
    ? (raw as AppointmentPurpose)
    : "product";
}

export const PURPOSE_LABEL: Readonly<Record<AppointmentPurpose, string>> = {
  product: "Mahsulot",
  treatment: "Muolaja",
  consultation: "Konsultatsiya",
  checkup: "Ko'rik",
  other: "Boshqa",
};

/**
 * Whether the client walked in or was booked ahead.
 *
 * This is what the form's mode switch produces: "Hozir keldi" sends NO time at
 * all and the visit is `arrived` on the server's own clock, while "Keyinroq
 * keladi" books a future slot and triggers the reminder chain.
 */
export type VisitType = "walk_in" | "scheduled";

export function parseVisitType(raw: unknown): VisitType {
  return raw === "walk_in" ? "walk_in" : "scheduled";
}

export const VISIT_TYPE_LABEL: Readonly<Record<VisitType, string>> = {
  walk_in: "Hozir keldi",
  scheduled: "Rejalashtirilgan",
};

/**
 * Appointment lifecycle. `no_show` is set automatically by a nightly backend
 * job — there is no UI action for it; it only ever appears as a read state.
 */
export const APPOINTMENT_STATUSES = [
  "scheduled",
  "arrived",
  "cancelled",
  "no_show",
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export function parseAppointmentStatus(raw: unknown): AppointmentStatus {
  return APPOINTMENT_STATUSES.includes(raw as AppointmentStatus)
    ? (raw as AppointmentStatus)
    : "scheduled";
}

export const APPOINTMENT_STATUS_LABEL: Readonly<Record<AppointmentStatus, string>> = {
  scheduled: "Rejalashtirilgan",
  arrived: "Keldi",
  cancelled: "Bekor qilingan",
  no_show: "Kelmadi",
};

/** The order this visit ended in, when it ended in one. */
export interface AppointmentOrderRef {
  readonly id: string;
  readonly orderNumber: string;
  readonly totalAmount: number;
}

/** A service performed during a visit, as summarised inside the appointment. */
export interface AppointmentTreatmentRef {
  readonly id: string;
  readonly kindLabel: string;
  readonly description: string;
  readonly amount: number;
  readonly doctorName: string;
}

/**
 * A client visit.
 *
 * `client` is present for EVERY visit since the CRM rework: the backend
 * resolves a card even for someone who has never installed the app, so any row
 * can open the 360° profile. It stays nullable only so an older payload can't
 * break the list.
 */
export interface Appointment {
  /** Branch the record was made in; null on an older payload. */
  readonly filial: FilialRef | null;
  readonly id: string;
  readonly client: ClientRef | null;
  readonly clientName: string;
  readonly clientPhone: string;
  readonly scheduledAt: TashkentDate;
  readonly purpose: AppointmentPurpose;
  readonly purposeDisplay: string;
  readonly doctor: DoctorRef | null;
  readonly note: string;
  readonly status: AppointmentStatus;
  readonly statusDisplay: string;
  readonly orderId: string | null;
  readonly arrivedAt: TashkentDate | null;
  readonly createdAt: TashkentDate;
  readonly visitType: VisitType;
  readonly visitTypeDisplay: string;
  /** Which visit this is for the client — 1 for a first-timer. */
  readonly visitNumber: number;
  readonly order: AppointmentOrderRef | null;
  readonly treatments: readonly AppointmentTreatmentRef[];
  readonly createdByName: string;
}

export function appointmentStatusLabel(a: Appointment): string {
  return a.statusDisplay !== "" ? a.statusDisplay : APPOINTMENT_STATUS_LABEL[a.status];
}

export function appointmentPurposeLabel(a: Appointment): string {
  return a.purposeDisplay !== "" ? a.purposeDisplay : PURPOSE_LABEL[a.purpose];
}

export function visitTypeLabel(a: Appointment): string {
  return a.visitTypeDisplay !== "" ? a.visitTypeDisplay : VISIT_TYPE_LABEL[a.visitType];
}

/** Everything is editable only while the client hasn't arrived yet. */
export function isFullyEditable(a: Appointment): boolean {
  return a.status === "scheduled";
}

/**
 * Once they are here, the time and the name are settled facts — but the doctor,
 * the purpose and the note are still corrected all the time as the visit
 * unfolds, so those stay editable.
 */
export function isPartiallyEditable(a: Appointment): boolean {
  return a.status === "arrived";
}

export function isEditable(a: Appointment): boolean {
  return isFullyEditable(a) || isPartiallyEditable(a);
}

/**
 * True the moment a scheduled visit's time has arrived (or passed) while it is
 * still awaiting the client. Flips back to false as soon as the status leaves
 * `scheduled`, returning the row to its normal look.
 */
export function isDueAt(a: Appointment, now: TashkentDate): boolean {
  return a.status === "scheduled" && a.scheduledAt <= now;
}

/** Per-status counts from `GET appointments/today/`. */
export interface AppointmentCounts {
  readonly scheduled: number;
  readonly arrived: number;
  readonly noShow: number;
  readonly cancelled: number;
}

export const ZERO_APPOINTMENT_COUNTS: AppointmentCounts = {
  scheduled: 0,
  arrived: 0,
  noShow: 0,
  cancelled: 0,
};

/** Per-doctor split of today's queue, so reception can see who is busy. */
export interface DoctorQueueCount {
  readonly doctorId: string;
  readonly fullName: string;
  readonly scheduled: number;
  readonly arrived: number;
}

/** `GET appointments/today/` — a distinct, non-paginated shape. */
export interface TodayAppointments {
  readonly date: string;
  readonly counts: AppointmentCounts;
  /** Sorted by `scheduled_at` ascending. */
  readonly results: readonly Appointment[];
  /**
   * People physically waiting right now: arrived, but nothing recorded for them
   * yet. The single most useful number on the page.
   */
  readonly waitingCount: number;
  readonly nextAppointmentAt: TashkentDate | null;
  readonly byDoctor: readonly DoctorQueueCount[];
}

// --- Parsing ----------------------------------------------------------------

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}
function num(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}
function str(v: unknown, fallback = ""): string {
  return v === null || v === undefined ? fallback : String(v);
}

function parseOrderRef(raw: unknown): AppointmentOrderRef | null {
  if (!isRecord(raw)) return null;
  return {
    id: str(raw.id),
    orderNumber: str(raw.order_number),
    totalAmount: num(raw.total_amount),
  };
}

function parseTreatmentRefs(raw: unknown): AppointmentTreatmentRef[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isRecord).map((t) => ({
    id: str(t.id),
    kindLabel: str(
      t.kind_display,
      t.kind === "consultation" ? "Konsultatsiya" : "Muolaja",
    ),
    description: str(t.description),
    amount: num(t.amount),
    doctorName: str(t.doctor_name),
  }));
}

export function parseAppointment(raw: unknown): Appointment {
  const a = isRecord(raw) ? raw : {};
  const order = parseOrderRef(a.order);
  return {
    filial: parseFilialRef(a.filial),
    id: str(a.id),
    client: maybeParseClientRef(a.client),
    clientName: str(a.client_name),
    clientPhone: str(a.client_phone),
    scheduledAt: tashkentFromApi(str(a.scheduled_at)),
    purpose: parsePurpose(a.purpose),
    purposeDisplay: str(a.purpose_display),
    doctor: maybeParseDoctorRef(a.doctor),
    note: str(a.note),
    status: parseAppointmentStatus(a.status),
    statusDisplay: str(a.status_display),
    // Prefer the flat legacy field; fall back to the richer object so a backend
    // that only sends `order` still links the sale.
    orderId:
      a.order_id === null || a.order_id === undefined
        ? (order?.id ?? null)
        : String(a.order_id),
    arrivedAt: maybeTashkentFromApi(
      typeof a.arrived_at === "string" ? a.arrived_at : null,
    ),
    createdAt: tashkentFromApi(str(a.created_at)),
    visitType: parseVisitType(a.visit_type),
    visitTypeDisplay: str(a.visit_type_display),
    visitNumber: num(a.visit_number, 1),
    order,
    treatments: parseTreatmentRefs(a.treatments),
    createdByName: isRecord(a.created_by) ? str(a.created_by.full_name) : "",
  };
}

function countsFromResults(results: readonly Appointment[]): AppointmentCounts {
  let scheduled = 0;
  let arrived = 0;
  let noShow = 0;
  let cancelled = 0;
  for (const a of results) {
    if (a.status === "scheduled") scheduled++;
    else if (a.status === "arrived") arrived++;
    else if (a.status === "no_show") noShow++;
    else cancelled++;
  }
  return { scheduled, arrived, noShow, cancelled };
}

export function parseTodayAppointments(raw: unknown): TodayAppointments {
  const j = isRecord(raw) ? raw : {};
  // Tolerate the results living under `results`, `appointments` or `data`.
  const rawResults = j.results ?? j.appointments ?? j.data;
  const results = Array.isArray(rawResults)
    ? rawResults.filter(isRecord).map(parseAppointment)
    : [];

  // Use the server's counts when present; otherwise derive them, so the badges
  // are never all-zero just because `counts` was omitted.
  const counts = isRecord(j.counts)
    ? {
        scheduled: num(j.counts.scheduled),
        arrived: num(j.counts.arrived),
        noShow: num(j.counts.no_show),
        cancelled: num(j.counts.cancelled),
      }
    : countsFromResults(results);

  return {
    date: str(j.date),
    counts,
    results,
    // Everyone marked "arrived" is, by definition, still in the room.
    waitingCount: typeof j.waiting_count === "number" ? j.waiting_count : counts.arrived,
    nextAppointmentAt: maybeTashkentFromApi(
      typeof j.next_appointment_at === "string" ? j.next_appointment_at : null,
    ),
    byDoctor: Array.isArray(j.by_doctor)
      ? j.by_doctor.filter(isRecord).map((d) => ({
          doctorId: str(d.doctor_id),
          fullName: str(d.full_name),
          scheduled: num(d.scheduled),
          arrived: num(d.arrived),
        }))
      : [],
  };
}
