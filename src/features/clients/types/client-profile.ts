import {
  parseAppointment,
  type Appointment,
} from "@/features/appointments/types/appointment";
import { parseDebt, type Debt } from "@/features/debts/types/debt";
import { parseOrderSummary, type OrderSummary } from "@/features/orders/types/order";
import { parseTreatment, type Treatment } from "@/features/treatments/types/treatment";

import { parseClientEvent, type ClientEvent } from "./client-event";
import { parseClientNote, type ClientNote } from "./client-note";
import { emptyRecord, parseClientRecord, type ClientRecord } from "./client-record";
import {
  EMPTY_CLIENT_SUMMARY,
  parseClientSummary,
  type ClientSummary,
} from "./client-summary";

/**
 * Everything the 360° card shows in one payload: `GET clients/profile/?phone=`
 * or `GET clients/{id}/`.
 *
 * The embedded lists carry the most recent ten of each kind — enough to fill
 * every tab on open, with the tab's own endpoint paginating from there. That is
 * what makes the card look complete on the first frame instead of firing six
 * requests as reception clicks around.
 */
export interface ClientProfile {
  readonly client: ClientRecord;
  readonly summary: ClientSummary;
  readonly visits: readonly Appointment[];
  readonly orders: readonly OrderSummary[];
  readonly treatments: readonly Treatment[];
  readonly debts: readonly Debt[];
  readonly notes: readonly ClientNote[];
  readonly timeline: readonly ClientEvent[];
}

/**
 * True when this phone has no card yet — the backend answers 200 with an empty
 * profile rather than 404, so reception can act on it immediately.
 */
export function isEmptyProfile(profile: ClientProfile): boolean {
  return profile.client.id === null;
}

/** A blank profile for a phone the clinic has never seen. */
export function emptyProfile(phone: string): ClientProfile {
  return {
    client: emptyRecord(phone),
    summary: EMPTY_CLIENT_SUMMARY,
    visits: [],
    orders: [],
    treatments: [],
    debts: [],
    notes: [],
    timeline: [],
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function list<T>(raw: unknown, parse: (item: unknown) => T): T[] {
  return Array.isArray(raw) ? raw.filter(isRecord).map(parse) : [];
}

/**
 * Parses both response shapes: the profile envelope (`{client: {…}, …}`) and a
 * bare client card from `clients/{id}/`.
 */
export function parseClientProfile(raw: unknown): ClientProfile {
  const json = isRecord(raw) ? raw : {};
  const rawClient = json.client;
  return {
    client: parseClientRecord(isRecord(rawClient) ? rawClient : json),
    summary: isRecord(json.summary)
      ? parseClientSummary(json.summary)
      : EMPTY_CLIENT_SUMMARY,
    visits: list(json.visits, parseAppointment),
    orders: list(json.orders, parseOrderSummary),
    treatments: list(json.treatments, parseTreatment),
    debts: list(json.debts, parseDebt),
    notes: list(json.notes, parseClientNote),
    timeline: list(json.timeline, parseClientEvent),
  };
}
