"use client";

import { ArrowLeft, CalendarPlus, UserPlus, UserSearch } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AppointmentFormDialog } from "@/features/appointments/components/appointment-form-dialog";
import { AppRoutes, clientDetailPath } from "@/config/routes";
import { AppCard } from "@/shared/components/data-display/app-card";
import { PageContainer } from "@/shared/components/data-display/page-container";
import { EmptyState } from "@/shared/components/feedback/empty-state";
import { ErrorState } from "@/shared/components/feedback/error-state";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { phoneFromApi } from "@/shared/lib/format/phone";

import {
  useClientProfileByPhoneQuery,
  useClientProfileQuery,
} from "../hooks/use-client-profile";
import { isEmptyProfile } from "../types/client-profile";
import { ClientActionsProvider, useClientActions } from "./client-actions-provider";
import { ClientProfileActions } from "./client-profile-actions";
import { ClientProfileHeader } from "./client-profile-header";
import { ClientProfileTabs } from "./client-profile-tabs";
import { ClientSummaryGrid } from "./client-summary-grid";

/**
 * The 360° client card as a page of its own.
 *
 * Addressed either by id or by phone — the second is reception's real starting
 * point, because a person at the desk is a number long before they are a record.
 */
export function ClientProfileView(
  props: { clientId: number; phone?: never } | { phone: string; clientId?: never },
) {
  return (
    <ClientActionsProvider>
      <ProfileBody {...props} />
    </ClientActionsProvider>
  );
}

function ProfileBody({ clientId, phone }: { clientId?: number; phone?: string }) {
  const router = useRouter();
  const actions = useClientActions();

  const byId = useClientProfileQuery(clientId ?? null);
  const byPhone = useClientProfileByPhoneQuery(phone ?? null);
  const query = clientId !== undefined ? byId : byPhone;

  const [visitOpen, setVisitOpen] = useState(false);

  const resolvedId = query.data?.client.id ?? null;
  // Landing here by phone once the card exists: the id route is the stable
  // address, so the URL is corrected rather than left as a lookup.
  useEffect(() => {
    if (phone !== undefined && resolvedId !== null) {
      router.replace(clientDetailPath(resolvedId));
    }
  }, [phone, resolvedId, router]);

  if (query.error && !query.data) {
    return (
      <PageContainer>
        <ErrorState
          error={query.error}
          onRetry={() => void query.refetch()}
          title="Mijoz kartasini yuklab bo'lmadi"
        />
      </PageContainer>
    );
  }

  if (query.isPending || !query.data) {
    return (
      <PageContainer className="flex flex-col gap-4">
        <Skeleton className="h-[132px] rounded-lg" />
        <Skeleton className="h-[96px] rounded-lg" />
        <Skeleton className="h-[320px] rounded-lg" />
      </PageContainer>
    );
  }

  const profile = query.data;
  const client = profile.client;

  // A number the clinic has never seen resolves to an empty card rather than a
  // 404 — precisely so this page can offer to start something instead of
  // ending in "not found".
  if (isEmptyProfile(profile)) {
    const number = phone ?? client.phone;
    return (
      <PageContainer className="flex flex-col gap-4">
        <BackLink />
        <AppCard>
          <EmptyState
            icon={UserSearch}
            title="Bu raqam bazada yo'q"
            message={`${phoneFromApi(number)} bo'yicha karta topilmadi. Yangi karta oching yoki to'g'ridan-to'g'ri tashrif yozing.`}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={() => actions.create({ phone: number })}>
                  <UserPlus className="size-4" aria-hidden />
                  Mijoz yaratish
                </Button>
                <Button variant="outline" onClick={() => setVisitOpen(true)}>
                  <CalendarPlus className="size-4" aria-hidden />
                  Tashrif yozish
                </Button>
              </div>
            }
          />
        </AppCard>

        <AppointmentFormDialog
          open={visitOpen}
          onOpenChange={setVisitOpen}
          initialPhone={number}
          onSaved={() => router.refresh()}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer className="flex flex-col gap-4">
      <BackLink />

      <AppCard className="flex flex-col gap-4">
        <ClientProfileHeader client={client} />
        <ClientProfileActions client={client} />
      </AppCard>

      <AppCard>
        <ClientSummaryGrid summary={profile.summary} />
      </AppCard>

      {client.id !== null && (
        <AppCard>
          <ClientProfileTabs profile={profile} clientId={client.id} />
        </AppCard>
      )}
    </PageContainer>
  );
}

function BackLink() {
  return (
    <Link
      href={AppRoutes.clients}
      className="text-label-sm text-text-secondary hover:text-text-primary focus-visible:ring-ring inline-flex w-fit items-center gap-1.5 rounded-sm focus-visible:ring-2 focus-visible:outline-none"
    >
      <ArrowLeft className="size-4" aria-hidden />
      Mijozlar
    </Link>
  );
}
