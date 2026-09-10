import { IDEMPOTENCY_HEADER, endpoints } from "@/shared/lib/api/endpoints";
import { http, type Query } from "@/shared/lib/api/http";
import { parsePaginated, type Paginated } from "@/shared/lib/api/pagination";
import { toApiIso, ymd, type TashkentDate } from "@/shared/lib/format/date";
import { uuidV4 } from "@/shared/lib/uuid";

import {
  parseAppointment,
  parseTodayAppointments,
  type Appointment,
  type AppointmentPurpose,
  type AppointmentStatus,
  type TodayAppointments,
  type VisitType,
} from "../types/appointment";

export interface AppointmentFilter {
  /** A single Tashkent day; null = all dates. */
  readonly date?: TashkentDate | null;
  readonly dateFrom?: TashkentDate | null;
  readonly dateTo?: TashkentDate | null;
  readonly status?: AppointmentStatus | null;
  readonly search?: string;
  readonly doctorId?: string | null;
  readonly purpose?: AppointmentPurpose | null;
  readonly visitType?: VisitType | null;
  readonly clientId?: number | null;
  readonly ordering?: string;
}

/** The backend's own default; sending it would only add noise to every URL. */
const DEFAULT_ORDERING = "scheduled_at";

export function appointmentFilterQuery(filter: AppointmentFilter): Query {
  return {
    ...(filter.date ? { date: ymd(filter.date) } : {}),
    ...(filter.dateFrom ? { date_from: ymd(filter.dateFrom) } : {}),
    ...(filter.dateTo ? { date_to: ymd(filter.dateTo) } : {}),
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.search?.trim() ? { search: filter.search.trim() } : {}),
    ...(filter.doctorId ? { doctor_id: filter.doctorId } : {}),
    ...(filter.purpose ? { purpose: filter.purpose } : {}),
    ...(filter.visitType ? { visit_type: filter.visitType } : {}),
    ...(filter.clientId ? { client_id: filter.clientId } : {}),
    ...(filter.ordering && filter.ordering !== DEFAULT_ORDERING
      ? { ordering: filter.ordering }
      : {}),
  };
}

export function appointmentFilterKey(filter: AppointmentFilter): readonly unknown[] {
  return [
    filter.date?.getTime() ?? null,
    filter.dateFrom?.getTime() ?? null,
    filter.dateTo?.getTime() ?? null,
    filter.status ?? null,
    filter.search?.trim() ?? "",
    filter.doctorId ?? null,
    filter.purpose ?? null,
    filter.visitType ?? null,
    filter.clientId ?? null,
    filter.ordering ?? DEFAULT_ORDERING,
  ];
}

/** `GET appointments/today/` — today's counts plus the time-ordered list. */
export function fetchToday(
  date?: TashkentDate | null,
  signal?: AbortSignal,
): Promise<TodayAppointments> {
  return http
    .get<unknown>(endpoints.appointmentsToday, {
      query: date ? { date: ymd(date) } : undefined,
      signal,
    })
    .then(parseTodayAppointments);
}

export function fetchAppointments(input: {
  filter: AppointmentFilter;
  page?: number;
  signal?: AbortSignal;
}): Promise<Paginated<Appointment>> {
  return http
    .get<unknown>(endpoints.appointments, {
      query: { page: input.page ?? 1, ...appointmentFilterQuery(input.filter) },
      signal: input.signal,
    })
    .then((raw) => parsePaginated(raw as never, parseAppointment));
}

export interface CreateAppointmentInput {
  /** API phone value `998XXXXXXXXX`. */
  readonly clientPhone: string;
  readonly clientName: string;
  /** Tashkent wall-clock for a booked visit; null for a walk-in. */
  readonly scheduledAt?: TashkentDate | null;
  /** True when the client is standing at the desk right now. */
  readonly arriveNow: boolean;
  readonly purpose: AppointmentPurpose;
  readonly doctorId?: string | null;
  readonly note?: string;
  readonly idempotencyKey?: string;
}

export interface CreateAppointmentResult {
  readonly appointment: Appointment;
  /**
   * Whether an in-app reminder can reach this client. `false` is a normal
   * outcome, not an error — it means reception should phone instead.
   */
  readonly inApp: boolean;
  /** A brand-new CRM card was opened by this booking. */
  readonly clientCreated: boolean;
}

export function createAppointment(
  input: CreateAppointmentInput,
): Promise<CreateAppointmentResult> {
  return http
    .post<Record<string, unknown>>(endpoints.appointments, {
      json: {
        client_phone: input.clientPhone,
        client_name: input.clientName,
        // Omitted entirely for a walk-in — the server's clock is the right one,
        // and no reminder is queued for a visit that is already happening.
        ...(!input.arriveNow && input.scheduledAt
          ? { scheduled_at: toApiIso(input.scheduledAt) }
          : {}),
        ...(input.arriveNow ? { arrive_now: true } : {}),
        purpose: input.purpose,
        ...(input.doctorId ? { doctor_id: Number.parseInt(input.doctorId, 10) } : {}),
        ...(input.note?.trim() ? { note: input.note.trim() } : {}),
      },
      headers: {
        // Same key on every retry of one submission, so a dropped connection
        // can't book the same client twice.
        [IDEMPOTENCY_HEADER]: input.idempotencyKey ?? uuidV4(),
      },
    })
    .then((data) => {
      // Tolerate either the documented envelope or a bare appointment object.
      const nested = data?.appointment;
      return {
        appointment: parseAppointment(
          typeof nested === "object" && nested !== null ? nested : data,
        ),
        inApp: data?.in_app === true,
        clientCreated: data?.client_created === true,
      };
    });
}

/**
 * `PATCH appointments/{id}/`.
 *
 * `client_phone` is deliberately absent — a different phone means a different
 * person, and therefore a different visit. `partial` mirrors the backend's edit
 * window: once the client has arrived, only the doctor, the purpose and the
 * note may still change, so the time and the name are not even sent.
 */
export function updateAppointment(
  id: string,
  input: {
    clientName: string;
    scheduledAt: TashkentDate | null;
    purpose: AppointmentPurpose;
    doctorId?: string | null;
    note?: string;
    partial: boolean;
  },
): Promise<Appointment> {
  const editableAfterArrival = {
    purpose: input.purpose,
    ...(input.doctorId ? { doctor_id: Number.parseInt(input.doctorId, 10) } : {}),
    ...(input.note !== undefined ? { note: input.note.trim() } : {}),
  };

  return http
    .patch<Record<string, unknown>>(endpoints.appointment(id), {
      json: input.partial
        ? editableAfterArrival
        : {
            client_name: input.clientName,
            ...(input.scheduledAt ? { scheduled_at: toApiIso(input.scheduledAt) } : {}),
            ...editableAfterArrival,
          },
    })
    .then(unwrapAppointment);
}

/** `POST appointments/{id}/arrived/`; `orderId` optionally links the sale. */
export function markArrived(id: string, orderId?: string | null): Promise<Appointment> {
  return http
    .post<Record<string, unknown>>(endpoints.appointmentArrived(id), {
      json: orderId ? { order_id: orderId } : undefined,
    })
    .then(unwrapAppointment);
}

export function cancelAppointment(id: string): Promise<Appointment> {
  return http
    .post<Record<string, unknown>>(endpoints.appointmentCancel(id))
    .then(unwrapAppointment);
}

/**
 * Tolerates either a bare appointment object or one wrapped as
 * `{ "appointment": {…} }` — the spec doesn't fix the arrived/cancel shape.
 */
function unwrapAppointment(data: Record<string, unknown> | null): Appointment {
  const nested = data?.appointment;
  return parseAppointment(typeof nested === "object" && nested !== null ? nested : data);
}
