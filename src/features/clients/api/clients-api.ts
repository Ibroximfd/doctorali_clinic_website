import { endpoints } from "@/shared/lib/api/endpoints";
import { ApiError } from "@/shared/lib/api/errors";
import { http } from "@/shared/lib/api/http";

import { searchResultFromRecord } from "../types/client-record";
import {
  isUnnamed,
  parseClientSearchResult,
  type ClientSearchResult,
} from "../types/client-search";
import { fetchClients } from "./clients-crm-api";

/**
 * Shortest query the typeahead endpoint accepts: 2 letters for a name, but 3
 * digits for a phone. Below that the server answers an empty list, so firing
 * the request is a wasted round-trip per keystroke.
 */
const MIN_NAME_LENGTH = 2;
const MIN_PHONE_DIGITS = 3;

/** How many rows the dropdown shows — a desk scans twenty, not ten. */
const DEFAULT_LIMIT = 20;

/** The digits of a query that IS a phone number (or part of one), else null. */
function phoneDigitsOf(query: string): string | null {
  const digits = query.replace(/[\s()+-]/g, "");
  return digits !== "" && /^\d+$/.test(digits) ? digits : null;
}

/** True when `query` is long enough to produce results. */
export function isSearchable(query: string): boolean {
  const trimmed = query.trim();
  if (trimmed === "") return false;
  const digits = phoneDigitsOf(trimmed);
  return digits !== null
    ? digits.length >= MIN_PHONE_DIGITS
    : trimmed.length >= MIN_NAME_LENGTH;
}

/**
 * Finds clients by name or phone — from EVERY endpoint that can answer.
 *
 * Three sources are asked at once and their rows merged:
 *
 *  • `clients/search/?q=` — the typeahead, built for this;
 *  • `clients/?search=` — the CRM list, which also matches the EXTRA phones on
 *    a card (a spouse's number, a work line) and tolerates a partial name;
 *  • `clients/?phone=` — the legacy lookup the Flutter order form used, sent
 *    only for a numeric query. It is the one that always carried `full_name`.
 *
 * The merge exists because of a real report: cards whose name is in the base
 * came back from the typeahead without one and rendered as "Mijoz 1234". A
 * name any of the three returns now fills the row, and a client only one of
 * them knows still appears. One source failing never empties the dropdown —
 * only all three failing does.
 *
 * "Nothing matched" is an empty dropdown, not an error banner: an older backend
 * answers 404 where the current one returns an empty list, and both mean the
 * same thing to the desk.
 */
export async function searchClients(input: {
  query: string;
  limit?: number;
  signal?: AbortSignal;
}): Promise<ClientSearchResult[]> {
  const query = input.query.trim();
  if (!isSearchable(query)) return [];
  const limit = input.limit ?? DEFAULT_LIMIT;
  const digits = phoneDigitsOf(query);

  const settled = await Promise.allSettled([
    fetchTypeahead(query, limit, input.signal),
    fetchClients({ filter: { search: query }, page: 1, signal: input.signal }).then(
      (page) => page.results.map(searchResultFromRecord),
    ),
    digits !== null && digits.length >= MIN_PHONE_DIGITS
      ? fetchLegacyByPhone(digits, input.signal)
      : Promise.resolve<ClientSearchResult[]>([]),
  ]);

  const sources = settled.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );
  if (sources.length === 0) {
    const [first] = settled;
    throw first.status === "rejected" ? first.reason : new Error("search failed");
  }
  return mergeSearchResults(sources, limit);
}

async function fetchTypeahead(
  query: string,
  limit: number,
  signal?: AbortSignal,
): Promise<ClientSearchResult[]> {
  try {
    const data = await http.get<Record<string, unknown>>(endpoints.clientsSearch, {
      query: { q: query, limit },
      signal,
    });
    return rowsOf(data);
  } catch (error) {
    if (ApiError.is(error) && error.isNotFound) return [];
    throw error;
  }
}

/** `GET clients/?phone=` — un-paginated `{results: []}`, phone only. */
async function fetchLegacyByPhone(
  digits: string,
  signal?: AbortSignal,
): Promise<ClientSearchResult[]> {
  try {
    const data = await http.get<Record<string, unknown>>(endpoints.clients, {
      query: { phone: digits },
      signal,
    });
    return rowsOf(data);
  } catch (error) {
    if (ApiError.is(error) && error.isNotFound) return [];
    throw error;
  }
}

function rowsOf(data: Record<string, unknown> | null | undefined): ClientSearchResult[] {
  const results = Array.isArray(data) ? data : data?.results;
  return Array.isArray(results)
    ? results
        .filter((item) => typeof item === "object" && item !== null)
        .map(parseClientSearchResult)
    : [];
}

/** The id when there is one, else the phone — a card always has one of the two. */
function identity(client: ClientSearchResult): string {
  return client.id > 0 ? `id:${client.id}` : `phone:${client.phone.replace(/\D/g, "")}`;
}

/**
 * Folds the sources into one list, in source order, one row per client.
 *
 * When two sources describe the same person, the row keeps its first position
 * and takes from the later one only what the first lacked: the name, the
 * avatar, the loyalty status, a zero counter.
 */
export function mergeSearchResults(
  sources: readonly (readonly ClientSearchResult[])[],
  limit: number,
): ClientSearchResult[] {
  const merged = new Map<string, ClientSearchResult>();
  for (const rows of sources) {
    for (const row of rows) {
      const key = identity(row);
      const existing = merged.get(key);
      merged.set(key, existing ? fillGaps(existing, row) : row);
    }
  }
  return [...merged.values()].slice(0, limit);
}

function fillGaps(
  base: ClientSearchResult,
  other: ClientSearchResult,
): ClientSearchResult {
  return {
    ...base,
    id: base.id > 0 ? base.id : other.id,
    fullName: base.fullName.trim() !== "" ? base.fullName : other.fullName,
    serverDisplayName:
      base.serverDisplayName.trim() !== "" || isUnnamed(other)
        ? base.serverDisplayName
        : other.serverDisplayName,
    isAppUser: base.isAppUser || other.isAppUser,
    visitsCount: base.visitsCount || other.visitsCount,
    ordersCount: base.ordersCount || other.ordersCount,
    openDebt: base.openDebt || other.openDebt,
    lastVisitAt: base.lastVisitAt ?? other.lastVisitAt,
    tags: base.tags.length > 0 ? base.tags : other.tags,
    isBlocked: base.isBlocked || other.isBlocked,
    avatarUrl: base.avatarUrl ?? other.avatarUrl,
    giftStatus: base.giftStatus ?? other.giftStatus,
  };
}
