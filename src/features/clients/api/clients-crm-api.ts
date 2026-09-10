import {
  parseAppointment,
  type Appointment,
} from "@/features/appointments/types/appointment";
import { parseDebt, type Debt } from "@/features/debts/types/debt";
import { parseOrderSummary, type OrderSummary } from "@/features/orders/types/order";
import { parseTreatment, type Treatment } from "@/features/treatments/types/treatment";
import { endpoints } from "@/shared/lib/api/endpoints";
import { ApiError } from "@/shared/lib/api/errors";
import { http, type Query } from "@/shared/lib/api/http";
import { parsePaginated, type Paginated } from "@/shared/lib/api/pagination";
import { ymd, type TashkentDate } from "@/shared/lib/format/date";

import {
  parseClientImportReport,
  parseDataQualityReport,
  parseDuplicatePair,
  type ClientImportReport,
  type DataQualityReport,
  type DuplicatePair,
} from "../types/client-admin";
import {
  CLIENT_EVENT_FILTER_KINDS,
  parseClientEvent,
  type ClientEvent,
  type ClientEventFilter,
} from "../types/client-event";
import { parseClientNote, type ClientNote } from "../types/client-note";
import {
  emptyProfile,
  parseClientProfile,
  type ClientProfile,
} from "../types/client-profile";
import {
  parseClientRecord,
  type ClientGender,
  type ClientPhone,
  type ClientRecord,
  type ClientSource,
} from "../types/client-record";
import { parseClientTags, type ClientTag } from "../types/client-search";
import { parseNotificationLog, type NotificationLog } from "../types/notification-log";

// --- Filtering ---------------------------------------------------------------

/**
 * One-tap segments above the list. Each expands to a ready-made filter so
 * reception never has to assemble "has debt AND overdue" by hand.
 */
export const CLIENT_SEGMENTS = [
  "all",
  "vip",
  "debtors",
  "overdue",
  "new",
  "lost",
] as const;
export type ClientSegment = (typeof CLIENT_SEGMENTS)[number];

export const CLIENT_SEGMENT_LABEL: Readonly<Record<ClientSegment, string>> = {
  all: "Hammasi",
  vip: "VIP",
  debtors: "Qarzdor",
  overdue: "Muddati o'tgan",
  new: "Yangi",
  lost: "Yo'qolgan",
};

/** The server's own nightly auto tags a segment rides on. */
const SEGMENT_TAG: Partial<Record<ClientSegment, string>> = {
  vip: "vip",
  new: "yangi",
  lost: "yoqolgan",
};

export const CLIENT_ORDERINGS = [
  "-last_visit_at",
  "-orders_total",
  "-orders_count",
  "-open_debt",
  "full_name",
  "-created_at",
] as const;
export type ClientOrdering = (typeof CLIENT_ORDERINGS)[number];

export const CLIENT_ORDERING_LABEL: Readonly<Record<ClientOrdering, string>> = {
  "-last_visit_at": "Oxirgi tashrif",
  "-orders_total": "Eng ko'p xarid",
  "-orders_count": "Buyurtmalar soni",
  "-open_debt": "Qarz miqdori",
  full_name: "Ism (A–Z)",
  "-created_at": "Yangi qo'shilgan",
};

export const DEFAULT_CLIENT_ORDERING: ClientOrdering = "-last_visit_at";

export interface ClientFilter {
  /** Name / phone / extra phone; under two characters the server ignores it. */
  readonly search?: string;
  readonly segment?: ClientSegment;
  /** Tag codes; sent as repeated `tag=` params (AND semantics server-side). */
  readonly tags?: readonly string[];
  readonly hasDebt?: boolean | null;
  readonly isAppUser?: boolean | null;
  readonly gender?: ClientGender | null;
  readonly source?: ClientSource | null;
  readonly ordering?: ClientOrdering;
}

/** True when anything beyond the default sort is narrowing the list. */
export function hasActiveFilters(filter: ClientFilter): boolean {
  return (
    (filter.segment ?? "all") !== "all" ||
    (filter.tags?.length ?? 0) > 0 ||
    filter.hasDebt !== null ||
    filter.isAppUser !== null ||
    (filter.gender ?? null) !== null ||
    (filter.source ?? null) !== null
  );
}

/**
 * Query parameters, with the segment expanded into concrete filters.
 *
 * A segment never overwrites an explicit filter of the same name: it supplies a
 * starting point, and the filter bar refines it. The catalog stops where the
 * documented one does — age/inactivity/doctor params were never part of the
 * contract, and sending them would only pretend to filter.
 */
export function clientFilterQuery(filter: ClientFilter): Query {
  const segment = filter.segment ?? "all";
  const segmentTag = SEGMENT_TAG[segment];
  const tags = [
    ...(filter.tags ?? []),
    ...(segmentTag && !(filter.tags ?? []).includes(segmentTag) ? [segmentTag] : []),
  ];
  const debtSegment = segment === "debtors" || segment === "overdue";

  return {
    ordering: filter.ordering ?? DEFAULT_CLIENT_ORDERING,
    ...(filter.search?.trim() ? { search: filter.search.trim() } : {}),
    ...(tags.length > 0 ? { tag: tags } : {}),
    ...(filter.hasDebt !== null && filter.hasDebt !== undefined
      ? { has_debt: String(filter.hasDebt) }
      : debtSegment
        ? { has_debt: "true" }
        : {}),
    ...(segment === "overdue" ? { debt_status: "overdue" } : {}),
    ...(filter.isAppUser !== null && filter.isAppUser !== undefined
      ? { is_app_user: String(filter.isAppUser) }
      : {}),
    ...(filter.gender && filter.gender !== "unknown" ? { gender: filter.gender } : {}),
    ...(filter.source && filter.source !== "unknown" ? { source: filter.source } : {}),
  };
}

export function clientFilterKey(filter: ClientFilter): readonly unknown[] {
  return [
    filter.search?.trim() ?? "",
    filter.segment ?? "all",
    [...(filter.tags ?? [])].sort().join(","),
    filter.hasDebt ?? null,
    filter.isAppUser ?? null,
    filter.gender ?? null,
    filter.source ?? null,
    filter.ordering ?? DEFAULT_CLIENT_ORDERING,
  ];
}

// --- Reads -------------------------------------------------------------------

export function fetchClients(input: {
  filter: ClientFilter;
  page?: number;
  signal?: AbortSignal;
}): Promise<Paginated<ClientRecord>> {
  return http
    .get<unknown>(endpoints.clients, {
      query: { page: input.page ?? 1, ...clientFilterQuery(input.filter) },
      signal: input.signal,
    })
    .then((raw) => parsePaginated(raw as never, parseClientRecord));
}

/**
 * `GET clients/profile/?phone=` — the 360° card for a phone number.
 *
 * A phone with no card yields an EMPTY profile, not an error: that is precisely
 * the case where reception needs the "create" buttons. An older backend answers
 * 404 for the same thing, so that is folded into the empty result too.
 */
export async function fetchProfileByPhone(
  phone: string,
  signal?: AbortSignal,
): Promise<ClientProfile> {
  try {
    const data = await http.get<unknown>(endpoints.clientProfile, {
      query: { phone },
      signal,
    });
    const profile = parseClientProfile(data);
    // A card with no id is the documented "nobody by that number" answer.
    return profile.client.id === null ? emptyProfile(phone) : profile;
  } catch (error) {
    if (ApiError.is(error) && error.isNotFound) return emptyProfile(phone);
    throw error;
  }
}

export function fetchProfile(
  clientId: number,
  signal?: AbortSignal,
): Promise<ClientProfile> {
  return http
    .get<unknown>(endpoints.client(clientId), { signal })
    .then(parseClientProfile);
}

export function fetchTimeline(input: {
  clientId: number;
  page?: number;
  filter?: ClientEventFilter;
  dateFrom?: TashkentDate | null;
  dateTo?: TashkentDate | null;
  signal?: AbortSignal;
}): Promise<Paginated<ClientEvent>> {
  const kinds = CLIENT_EVENT_FILTER_KINDS[input.filter ?? "all"];
  return http
    .get<unknown>(endpoints.clientTimeline(input.clientId), {
      query: {
        page: input.page ?? 1,
        ...(kinds.length > 0 ? { kind: [...kinds] } : {}),
        ...(input.dateFrom ? { date_from: ymd(input.dateFrom) } : {}),
        ...(input.dateTo ? { date_to: ymd(input.dateTo) } : {}),
      },
      signal: input.signal,
    })
    .then((raw) => parsePaginated(raw as never, parseClientEvent));
}

/**
 * The drill-downs behind the profile tabs.
 *
 * Each paginates independently once reception scrolls past the ten rows the
 * profile payload already carried.
 */
function fetchTab<T>(
  path: string,
  parse: (item: unknown) => T,
  page: number,
  signal?: AbortSignal,
): Promise<Paginated<T>> {
  return http
    .get<unknown>(path, { query: { page }, signal })
    .then((raw) => parsePaginated(raw as never, parse));
}

export function fetchClientOrders(clientId: number, page = 1, signal?: AbortSignal) {
  return fetchTab<OrderSummary>(
    endpoints.clientOrders(clientId),
    parseOrderSummary,
    page,
    signal,
  );
}

export function fetchClientVisits(clientId: number, page = 1, signal?: AbortSignal) {
  return fetchTab<Appointment>(
    endpoints.clientVisits(clientId),
    parseAppointment,
    page,
    signal,
  );
}

export function fetchClientTreatments(clientId: number, page = 1, signal?: AbortSignal) {
  return fetchTab<Treatment>(
    endpoints.clientTreatments(clientId),
    parseTreatment,
    page,
    signal,
  );
}

export function fetchClientDebts(clientId: number, page = 1, signal?: AbortSignal) {
  return fetchTab<Debt>(endpoints.clientDebts(clientId), parseDebt, page, signal);
}

export function fetchClientNotes(clientId: number, page = 1, signal?: AbortSignal) {
  return fetchTab<ClientNote>(
    endpoints.clientNotes(clientId),
    parseClientNote,
    page,
    signal,
  );
}

/** Messages the system sent (or tried to send) to this client. */
export function fetchClientNotifications(
  clientId: number,
  page = 1,
  signal?: AbortSignal,
): Promise<Paginated<NotificationLog>> {
  return http
    .get<unknown>(endpoints.notificationLogs, {
      query: { client_id: clientId, page },
      signal,
    })
    .then((raw) => parsePaginated(raw as never, parseNotificationLog));
}

/** `GET clients/tags/` — every tag known to the backend, for the editor. */
export function fetchAllTags(signal?: AbortSignal): Promise<ClientTag[]> {
  return http
    .get<unknown>(endpoints.clientsTags, { signal })
    .then((raw) =>
      parseClientTags(
        Array.isArray(raw) ? raw : ((raw as { results?: unknown })?.results ?? []),
      ),
    );
}

// --- Writes ------------------------------------------------------------------

export interface UpsertClientInput {
  /** API phone value `998XXXXXXXXX` — the upsert key. */
  readonly phone: string;
  readonly fullName: string;
  readonly gender: ClientGender;
  readonly birthDate: TashkentDate | null;
  /** Only meaningful when the birth date is unknown — some clients give an age. */
  readonly age: number | null;
  readonly address: string;
  readonly note: string;
  /** Tag codes; automatic tags are excluded by the form before it gets here. */
  readonly tags: readonly string[];
  readonly extraPhones: readonly ClientPhone[];
}

/**
 * Body for the create-or-update.
 *
 * Only fields the user actually filled in are sent: the backend never
 * overwrites a populated field with an empty one, and omitting a field is how
 * the app says "leave whatever you already know". That is what makes it safe to
 * save this form over an existing card.
 *
 * `forUpdate` drops the phone — a phone IS the card's identity and never
 * changes. A client who only gave their age is sent as a plain `age`, never
 * converted into a 1-January birth date: that would send every such client a
 * birthday greeting on New Year's Day.
 */
function upsertBody(
  input: UpsertClientInput,
  forUpdate: boolean,
): Record<string, unknown> {
  return {
    ...(forUpdate ? {} : { phone: input.phone }),
    ...(input.fullName.trim() !== "" ? { full_name: input.fullName.trim() } : {}),
    ...(input.gender !== "unknown" ? { gender: input.gender } : {}),
    ...(input.birthDate
      ? { birth_date: ymd(input.birthDate) }
      : input.age !== null && input.age > 0
        ? { age: input.age }
        : {}),
    ...(input.address.trim() !== "" ? { address: input.address.trim() } : {}),
    // A note is sent even when cleared: emptying it is an intentional edit.
    note: input.note.trim(),
    tags: [...input.tags],
    // Always sent — an omitted key would make deleting the last extra number
    // impossible, because the server would keep what it already has.
    extra_phones: input.extraPhones.map((p) => ({
      phone: p.phone,
      ...(p.label !== "" ? { label: p.label } : {}),
    })),
  };
}

export interface UpsertClientResult {
  readonly client: ClientRecord;
  /** So reception gets "Yangi mijoz qo'shildi" vs "Ma'lumot yangilandi". */
  readonly created: boolean;
}

export function upsertClient(input: UpsertClientInput): Promise<UpsertClientResult> {
  return http
    .post<Record<string, unknown>>(endpoints.clients, {
      json: upsertBody(input, false),
    })
    .then((data) => ({
      client: parseClientRecord(unwrap(data, "client")),
      created: data?.created === true,
    }));
}

export function updateClient(
  clientId: number,
  input: UpsertClientInput,
): Promise<ClientRecord> {
  return http
    .patch<Record<string, unknown>>(endpoints.client(clientId), {
      json: upsertBody(input, true),
    })
    .then((data) => parseClientRecord(unwrap(data, "client")));
}

export function addNote(clientId: number, text: string): Promise<ClientNote> {
  return http
    .post<Record<string, unknown>>(endpoints.clientNotes(clientId), {
      json: { text: text.trim() },
    })
    .then((data) => parseClientNote(unwrap(data, "note")));
}

/** `POST clients/{id}/tags/` — replaces the manual tag set. */
export function setClientTags(
  clientId: number,
  tagCodes: readonly string[],
): Promise<ClientRecord> {
  return http
    .post<Record<string, unknown>>(endpoints.clientTags(clientId), {
      json: { tags: [...tagCodes] },
    })
    .then((data) => parseClientRecord(unwrap(data, "client")));
}

/** Admin only; the reason is mandatory. */
export function blockClient(clientId: number, reason: string): Promise<ClientRecord> {
  return http
    .post<Record<string, unknown>>(endpoints.clientBlock(clientId), {
      json: { reason: reason.trim() },
    })
    .then((data) => parseClientRecord(unwrap(data, "client")));
}

export function unblockClient(clientId: number): Promise<ClientRecord> {
  return http
    .post<Record<string, unknown>>(endpoints.clientUnblock(clientId))
    .then((data) => parseClientRecord(unwrap(data, "client")));
}

/**
 * "Forgets" a client: name/address/notes wiped, phone masked, app link severed.
 * Money records survive. Irreversible, admin only.
 */
export function anonymizeClient(clientId: number): Promise<ClientRecord> {
  return http
    .post<Record<string, unknown>>(endpoints.clientAnonymize(clientId))
    .then((data) => parseClientRecord(unwrap(data, "client")));
}

export function fetchDuplicates(signal?: AbortSignal): Promise<DuplicatePair[]> {
  return http.get<unknown>(endpoints.clientsDuplicates, { signal }).then((raw) => {
    const items = Array.isArray(raw)
      ? raw
      : ((raw as { results?: unknown })?.results ?? []);
    return Array.isArray(items) ? items.map(parseDuplicatePair) : [];
  });
}

/** Folds `duplicateId` into `primaryId`. Irreversible; returns the survivor. */
export function mergeClients(input: {
  primaryId: number;
  duplicateId: number;
}): Promise<ClientRecord> {
  return http
    .post<Record<string, unknown>>(endpoints.clientsMerge, {
      json: { primary_id: input.primaryId, duplicate_id: input.duplicateId },
    })
    .then((data) => parseClientRecord(unwrap(data, "client")));
}

export function fetchDataQuality(signal?: AbortSignal): Promise<DataQualityReport> {
  return http
    .get<unknown>(endpoints.alertsDataQuality, { signal })
    .then(parseDataQualityReport);
}

export function exportClients(filter: ClientFilter) {
  return http.blob(endpoints.clientsExport, {
    query: clientFilterQuery(filter),
    fallbackFileName: "mijozlar.xlsx",
  });
}

/**
 * Spreadsheet import.
 *
 * `dryRun` defaults to true and writes NOTHING: the admin always sees the
 * report first and re-sends the same file to commit it.
 */
export function importClients(input: {
  file: File;
  dryRun?: boolean;
}): Promise<ClientImportReport> {
  const dryRun = input.dryRun ?? true;
  const formData = new FormData();
  formData.append("file", input.file, input.file.name);
  formData.append("dry_run", String(dryRun));
  return http
    .post<unknown>(endpoints.clientsImport, { formData })
    .then((raw) => parseClientImportReport(raw, dryRun));
}

/**
 * Tolerates either a bare client object or one wrapped as `{ "client": {…} }` —
 * the action endpoints aren't explicit about which they return.
 */
function unwrap(data: Record<string, unknown> | null, key: string): unknown {
  if (!data) return {};
  const nested = data[key];
  return typeof nested === "object" && nested !== null ? nested : data;
}
