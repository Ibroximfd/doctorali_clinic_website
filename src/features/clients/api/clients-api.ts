import { endpoints } from "@/shared/lib/api/endpoints";
import { ApiError } from "@/shared/lib/api/errors";
import { http } from "@/shared/lib/api/http";

import { parseClientSearchResult, type ClientSearchResult } from "../types/client-search";

/**
 * Shortest query the typeahead endpoint accepts: 2 letters for a name, but 3
 * digits for a phone. Below that the server answers an empty list, so firing
 * the request is a wasted round-trip per keystroke.
 */
const MIN_NAME_LENGTH = 2;
const MIN_PHONE_DIGITS = 3;

/** True when `query` is long enough to produce results. */
export function isSearchable(query: string): boolean {
  const trimmed = query.trim();
  if (trimmed === "") return false;
  const digits = trimmed.replace(/[\s()+-]/g, "");
  const isPhone = digits !== "" && /^\d+$/.test(digits);
  return isPhone ? digits.length >= MIN_PHONE_DIGITS : trimmed.length >= MIN_NAME_LENGTH;
}

/**
 * `GET clients/search/?q=` — the typeahead.
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

  try {
    const data = await http.get<Record<string, unknown>>(endpoints.clientsSearch, {
      query: { q: query, limit: input.limit ?? 10 },
      signal: input.signal,
    });
    const results = data?.results;
    return Array.isArray(results)
      ? results
          .filter((item) => typeof item === "object" && item !== null)
          .map(parseClientSearchResult)
      : [];
  } catch (error) {
    if (ApiError.is(error) && error.isNotFound) return [];
    throw error;
  }
}
