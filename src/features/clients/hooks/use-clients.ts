"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ApiError } from "@/shared/lib/api/errors";
import { saveBlob } from "@/shared/lib/download";

import {
  addNote,
  anonymizeClient,
  blockClient,
  clientFilterKey,
  exportClients,
  fetchAllTags,
  fetchClients,
  fetchDataQuality,
  fetchDuplicates,
  importClients,
  mergeClients,
  setClientTags,
  unblockClient,
  updateClient,
  upsertClient,
  type ClientFilter,
  type UpsertClientInput,
} from "../api/clients-crm-api";
import { clientKeys } from "./use-client-search";

export const crmKeys = {
  list: (filter: ClientFilter, page: number) =>
    [...clientKeys.all, "list", ...clientFilterKey(filter), page] as const,
  tags: [...clientKeys.all, "tags"] as const,
  duplicates: [...clientKeys.all, "duplicates"] as const,
  dataQuality: [...clientKeys.all, "data-quality"] as const,
};

export function useClientsQuery(filter: ClientFilter, page: number) {
  return useQuery({
    queryKey: crmKeys.list(filter, page),
    queryFn: ({ signal }) => fetchClients({ filter, page, signal }),
    placeholderData: (previous) => previous,
  });
}

/** The whole tag vocabulary — rarely changes, so it is cached for the session. */
export function useClientTagsQuery() {
  return useQuery({
    queryKey: crmKeys.tags,
    queryFn: ({ signal }) => fetchAllTags(signal),
    staleTime: 10 * 60_000,
  });
}

export function useDuplicatesQuery(enabled: boolean) {
  return useQuery({
    queryKey: crmKeys.duplicates,
    queryFn: ({ signal }) => fetchDuplicates(signal),
    enabled,
    staleTime: 60_000,
  });
}

export function useDataQualityQuery(enabled: boolean) {
  return useQuery({
    queryKey: crmKeys.dataQuality,
    queryFn: ({ signal }) => fetchDataQuality(signal),
    enabled,
    staleTime: 60_000,
  });
}

/**
 * Every client write touches the same card from several angles — the list row,
 * the 360° profile, the typeahead — so they all refresh together rather than
 * leaving one view claiming something the others have moved on from.
 */
export function useInvalidateClients() {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: clientKeys.all });
  };
}

function reportError(error: unknown, fallback: string) {
  toast.error(ApiError.is(error) ? error.message : fallback);
}

export function useUpsertClient() {
  const invalidate = useInvalidateClients();
  return useMutation({
    mutationFn: (input: UpsertClientInput) => upsertClient(input),
    onSuccess: (result) => {
      invalidate();
      toast.success(result.created ? "Yangi mijoz qo'shildi" : "Ma'lumot yangilandi");
    },
    onError: (error) => reportError(error, "Mijozni saqlab bo'lmadi"),
  });
}

export function useUpdateClient() {
  const invalidate = useInvalidateClients();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpsertClientInput }) =>
      updateClient(id, input),
    onSuccess: () => {
      invalidate();
      toast.success("Ma'lumot yangilandi");
    },
    onError: (error) => reportError(error, "Mijozni saqlab bo'lmadi"),
  });
}

export function useAddClientNote() {
  const invalidate = useInvalidateClients();
  return useMutation({
    mutationFn: ({ clientId, text }: { clientId: number; text: string }) =>
      addNote(clientId, text),
    onSuccess: () => {
      invalidate();
      toast.success("Izoh qo'shildi");
    },
    onError: (error) => reportError(error, "Izohni saqlab bo'lmadi"),
  });
}

export function useSetClientTags() {
  const invalidate = useInvalidateClients();
  return useMutation({
    mutationFn: ({ clientId, tags }: { clientId: number; tags: readonly string[] }) =>
      setClientTags(clientId, tags),
    onSuccess: () => {
      invalidate();
      toast.success("Teglar yangilandi");
    },
    onError: (error) => reportError(error, "Teglarni saqlab bo'lmadi"),
  });
}

export function useBlockClient() {
  const invalidate = useInvalidateClients();
  return useMutation({
    mutationFn: ({ clientId, reason }: { clientId: number; reason: string }) =>
      blockClient(clientId, reason),
    onSuccess: () => {
      invalidate();
      toast.success("Mijoz bloklandi");
    },
    onError: (error) => reportError(error, "Bloklab bo'lmadi"),
  });
}

export function useUnblockClient() {
  const invalidate = useInvalidateClients();
  return useMutation({
    mutationFn: (clientId: number) => unblockClient(clientId),
    onSuccess: () => {
      invalidate();
      toast.success("Blok olib tashlandi");
    },
    onError: (error) => reportError(error, "Blokni olib tashlab bo'lmadi"),
  });
}

export function useAnonymizeClient() {
  const invalidate = useInvalidateClients();
  return useMutation({
    mutationFn: (clientId: number) => anonymizeClient(clientId),
    onSuccess: () => {
      invalidate();
      toast.success("Mijoz ma'lumotlari o'chirildi");
    },
    onError: (error) => reportError(error, "O'chirib bo'lmadi"),
  });
}

export function useMergeClients() {
  const invalidate = useInvalidateClients();
  return useMutation({
    mutationFn: (input: { primaryId: number; duplicateId: number }) =>
      mergeClients(input),
    onSuccess: () => {
      invalidate();
      toast.success("Kartalar birlashtirildi");
    },
    onError: (error) => reportError(error, "Birlashtirib bo'lmadi"),
  });
}

export function useClientsExport() {
  return useMutation({
    mutationFn: (filter: ClientFilter) => exportClients(filter),
    onSuccess: ({ blob, fileName }) => {
      saveBlob(blob, fileName);
      toast.success("Fayl yuklandi");
    },
    onError: (error) => reportError(error, "Eksport qilib bo'lmadi"),
  });
}

/**
 * The import runs twice on purpose: once as a preview that writes nothing, then
 * again with the same file to commit. Only the committing run invalidates.
 */
export function useImportClients() {
  const invalidate = useInvalidateClients();
  return useMutation({
    mutationFn: (input: { file: File; dryRun: boolean }) => importClients(input),
    onSuccess: (report) => {
      if (report.dryRun) return;
      invalidate();
      toast.success(`${report.created} ta qo'shildi · ${report.updated} ta yangilandi`);
    },
    onError: (error) => reportError(error, "Faylni import qilib bo'lmadi"),
  });
}
