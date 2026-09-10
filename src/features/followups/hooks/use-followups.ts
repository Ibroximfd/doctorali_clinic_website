"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ApiError } from "@/shared/lib/api/errors";

import {
  fetchFollowupHistory,
  fetchFollowups,
  followupFilterKey,
  recordContact,
  type FollowupFilter,
} from "../api/followups-api";
import type { FollowupStatus } from "../types/followup";

export const followupKeys = {
  all: ["followups"] as const,
  list: (filter: FollowupFilter, page: number) =>
    [...followupKeys.all, "list", ...followupFilterKey(filter), page] as const,
  history: (clientId: number) => [...followupKeys.all, "history", clientId] as const,
};

export function useFollowupsQuery(filter: FollowupFilter, page: number) {
  return useQuery({
    queryKey: followupKeys.list(filter, page),
    queryFn: ({ signal }) => fetchFollowups({ filter, page, signal }),
    placeholderData: (previous) => previous,
  });
}

export function useFollowupHistoryQuery(clientId: number | null) {
  return useQuery({
    queryKey: followupKeys.history(clientId ?? 0),
    queryFn: ({ signal }) =>
      fetchFollowupHistory({ clientId: clientId as number, signal }),
    enabled: clientId !== null,
  });
}

export function useRecordContact() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { clientId: number; status: FollowupStatus; note?: string }) =>
      recordContact(input),
    onSuccess: (_, variables) => {
      void client.invalidateQueries({ queryKey: followupKeys.all });
      void client.invalidateQueries({
        queryKey: followupKeys.history(variables.clientId),
      });
      toast.success("Bog'lanish qayd etildi");
    },
    onError: (error) => {
      toast.error(ApiError.is(error) ? error.message : "Bog'lanishni qayd etib bo'lmadi");
    },
  });
}
