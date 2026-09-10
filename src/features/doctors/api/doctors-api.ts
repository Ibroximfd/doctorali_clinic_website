import { endpoints } from "@/shared/lib/api/endpoints";
import { http } from "@/shared/lib/api/http";
import { parsePaginated, type Paginated } from "@/shared/lib/api/pagination";

import { parseDoctor, type Doctor } from "../types/doctor";

/** `GET doctors/?search=&page=` — the commission-earning roster. */
export function fetchDoctors(input: {
  search?: string;
  page?: number;
  signal?: AbortSignal;
}): Promise<Paginated<Doctor>> {
  return http
    .get<unknown>(endpoints.doctors, {
      query: { page: input.page ?? 1, search: input.search },
      signal: input.signal,
    })
    .then((raw) => parsePaginated(raw as never, parseDoctor));
}
