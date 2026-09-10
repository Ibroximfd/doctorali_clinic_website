"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ApiError } from "@/shared/lib/api/errors";
import { ymd, type TashkentDate } from "@/shared/lib/format/date";

import {
  appointmentFilterKey,
  cancelAppointment,
  createAppointment,
  fetchAppointments,
  fetchToday,
  markArrived,
  updateAppointment,
  type AppointmentFilter,
  type CreateAppointmentInput,
} from "../api/appointments-api";

export const appointmentKeys = {
  all: ["appointments"] as const,
  today: (date: TashkentDate | null) =>
    [...appointmentKeys.all, "today", date ? ymd(date) : "today"] as const,
  list: (filter: AppointmentFilter, page: number) =>
    [...appointmentKeys.all, "list", ...appointmentFilterKey(filter), page] as const,
};

/**
 * Today's queue.
 *
 * Refetched every minute: this is the one list that changes while nobody is
 * touching the panel — a client walks in, a doctor frees up — and a stale queue
 * is what makes reception promise a wait that isn't real.
 */
export function useTodayAppointmentsQuery(date: TashkentDate | null = null) {
  return useQuery({
    queryKey: appointmentKeys.today(date),
    queryFn: ({ signal }) => fetchToday(date, signal),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

export function useAppointmentsQuery(filter: AppointmentFilter, page: number) {
  return useQuery({
    queryKey: appointmentKeys.list(filter, page),
    queryFn: ({ signal }) => fetchAppointments({ filter, page, signal }),
    placeholderData: (previous) => previous,
  });
}

function useInvalidateAppointments() {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: appointmentKeys.all });
    void client.invalidateQueries({ queryKey: ["statistics"] });
    void client.invalidateQueries({ queryKey: ["clients"] });
  };
}

function reportError(error: unknown, fallback: string) {
  toast.error(ApiError.is(error) ? error.message : fallback);
}

export function useCreateAppointment() {
  const invalidate = useInvalidateAppointments();
  return useMutation({
    mutationFn: (input: CreateAppointmentInput) => createAppointment(input),
    onSuccess: (result) => {
      invalidate();
      const parts = ["Tashrif yaratildi"];
      if (result.clientCreated) parts.push("yangi mijoz kartochkasi ochildi");
      // `in_app: false` is not an error — it just means the reminder can't be
      // delivered, so reception should plan to phone instead.
      if (!result.inApp && result.appointment.status === "scheduled") {
        parts.push("eslatma yuborilmaydi — mijoz ilovada emas");
      }
      toast.success(parts.join(" · "));
    },
    onError: (error) => reportError(error, "Tashrifni yaratib bo'lmadi"),
  });
}

export function useUpdateAppointment() {
  const invalidate = useInvalidateAppointments();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: Parameters<typeof updateAppointment>[1];
    }) => updateAppointment(id, input),
    onSuccess: () => {
      invalidate();
      toast.success("Tashrif yangilandi");
    },
    onError: (error) => reportError(error, "Tashrifni yangilab bo'lmadi"),
  });
}

export function useMarkArrived() {
  const invalidate = useInvalidateAppointments();
  return useMutation({
    mutationFn: ({ id, orderId }: { id: string; orderId?: string | null }) =>
      markArrived(id, orderId),
    onSuccess: () => {
      invalidate();
      toast.success("Mijoz keldi deb belgilandi");
    },
    onError: (error) => reportError(error, "Belgilab bo'lmadi"),
  });
}

export function useCancelAppointment() {
  const invalidate = useInvalidateAppointments();
  return useMutation({
    mutationFn: (id: string) => cancelAppointment(id),
    onSuccess: () => {
      invalidate();
      toast.success("Tashrif bekor qilindi");
    },
    onError: (error) => reportError(error, "Tashrifni bekor qilib bo'lmadi"),
  });
}
