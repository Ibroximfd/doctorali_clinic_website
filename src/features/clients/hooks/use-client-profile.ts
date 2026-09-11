"use client";

import { useQuery } from "@tanstack/react-query";

import type { TashkentDate } from "@/shared/lib/format/date";

import {
  fetchClientDebts,
  fetchClientNotes,
  fetchClientNotifications,
  fetchClientOrders,
  fetchClientTreatments,
  fetchClientVisits,
  fetchProfile,
  fetchProfileByPhone,
  fetchTimeline,
} from "../api/clients-crm-api";
import type { ClientEventFilter } from "../types/client-event";
import { clientKeys } from "./use-client-search";

export const profileKeys = {
  byId: (id: number) => [...clientKeys.all, "profile", id] as const,
  byPhone: (phone: string) => [...clientKeys.all, "profile", "phone", phone] as const,
  timeline: (
    id: number,
    filter: ClientEventFilter,
    page: number,
    // The range belongs in the KEY: without it a date filter would read a
    // cached page from a different period and quietly show the wrong history.
    dateFrom: TashkentDate | null = null,
    dateTo: TashkentDate | null = null,
  ) =>
    [
      ...clientKeys.all,
      "timeline",
      id,
      filter,
      page,
      dateFrom?.getTime() ?? null,
      dateTo?.getTime() ?? null,
    ] as const,
  tab: (id: number, tab: string, page: number) =>
    [...clientKeys.all, "tab", id, tab, page] as const,
};

export function useClientProfileQuery(clientId: number | null) {
  return useQuery({
    queryKey: profileKeys.byId(clientId ?? 0),
    queryFn: ({ signal }) => fetchProfile(clientId as number, signal),
    enabled: clientId !== null,
  });
}

/**
 * The phone-first lookup: reception knows the number and nothing else.
 *
 * A phone with no card resolves to an empty profile rather than an error, which
 * is what lets the page offer "create the card" instead of a dead end.
 */
export function useClientProfileByPhoneQuery(phone: string | null) {
  return useQuery({
    queryKey: profileKeys.byPhone(phone ?? ""),
    queryFn: ({ signal }) => fetchProfileByPhone(phone as string, signal),
    enabled: phone !== null && phone !== "",
  });
}

export function useClientTimelineQuery(input: {
  clientId: number;
  filter: ClientEventFilter;
  page: number;
  dateFrom?: TashkentDate | null;
  dateTo?: TashkentDate | null;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: profileKeys.timeline(
      input.clientId,
      input.filter,
      input.page,
      input.dateFrom ?? null,
      input.dateTo ?? null,
    ),
    queryFn: ({ signal }) =>
      fetchTimeline({
        clientId: input.clientId,
        page: input.page,
        filter: input.filter,
        dateFrom: input.dateFrom,
        dateTo: input.dateTo,
        signal,
      }),
    enabled: input.enabled ?? true,
    placeholderData: (previous) => previous,
  });
}

/**
 * The profile tabs' drill-downs.
 *
 * The profile payload already supplied the first ten rows of each; these run
 * when reception pages past them. Each tab gets its own hook rather than one
 * generic one, so the row type stays exact at every call site.
 */
export function useClientOrdersTab(clientId: number, page: number, enabled = true) {
  return useQuery({
    queryKey: profileKeys.tab(clientId, "orders", page),
    queryFn: ({ signal }) => fetchClientOrders(clientId, page, signal),
    enabled,
    placeholderData: (previous) => previous,
  });
}

export function useClientVisitsTab(clientId: number, page: number, enabled = true) {
  return useQuery({
    queryKey: profileKeys.tab(clientId, "visits", page),
    queryFn: ({ signal }) => fetchClientVisits(clientId, page, signal),
    enabled,
    placeholderData: (previous) => previous,
  });
}

export function useClientTreatmentsTab(clientId: number, page: number, enabled = true) {
  return useQuery({
    queryKey: profileKeys.tab(clientId, "treatments", page),
    queryFn: ({ signal }) => fetchClientTreatments(clientId, page, signal),
    enabled,
    placeholderData: (previous) => previous,
  });
}

export function useClientDebtsTab(clientId: number, page: number, enabled = true) {
  return useQuery({
    queryKey: profileKeys.tab(clientId, "debts", page),
    queryFn: ({ signal }) => fetchClientDebts(clientId, page, signal),
    enabled,
    placeholderData: (previous) => previous,
  });
}

export function useClientNotesTab(clientId: number, page: number, enabled = true) {
  return useQuery({
    queryKey: profileKeys.tab(clientId, "notes", page),
    queryFn: ({ signal }) => fetchClientNotes(clientId, page, signal),
    enabled,
    placeholderData: (previous) => previous,
  });
}

export function useClientNotificationsTab(
  clientId: number,
  page: number,
  enabled = true,
) {
  return useQuery({
    queryKey: profileKeys.tab(clientId, "messages", page),
    queryFn: ({ signal }) => fetchClientNotifications(clientId, page, signal),
    enabled,
    placeholderData: (previous) => previous,
  });
}
