"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { fetchDoctors } from "../api/doctors-api";
import type { Doctor } from "../types/doctor";

export const doctorKeys = {
  all: ["doctors"] as const,
  list: (search: string, page: number) =>
    [...doctorKeys.all, "list", search, page] as const,
};

/**
 * The doctor roster for a picker.
 *
 * Cached for five minutes: the roster changes a few times a year, and the New
 * Order form asks for it on every open.
 */
export function useDoctorsQuery(search = "", page = 1) {
  return useQuery({
    queryKey: doctorKeys.list(search, page),
    queryFn: ({ signal }) => fetchDoctors({ search, page, signal }),
    staleTime: 5 * 60_000,
    placeholderData: (previous) => previous,
  });
}

/**
 * Resolves one doctor by id from the cached roster.
 *
 * The Flutter app paged through the whole list on every lookup because the API
 * has no `doctors/{id}/`; here the list is already in the cache, so this is a
 * lookup rather than a request.
 */
export function useDoctorById(id: string | null): Doctor | null {
  const { data } = useDoctorsQuery();
  return useMemo(
    () => (id ? (data?.results.find((d) => d.id === id) ?? null) : null),
    [data, id],
  );
}
