"use client";

import {
  Download,
  Merge,
  MoreHorizontal,
  ShieldCheck,
  Upload,
  UserPlus,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { clientByPhonePath, clientDetailPath } from "@/config/routes";
import { AppCard } from "@/shared/components/data-display/app-card";
import { ListSkeleton } from "@/shared/components/data-display/list-skeleton";
import { PageContainer } from "@/shared/components/data-display/page-container";
import { PaginationBar } from "@/shared/components/data-display/pagination-bar";
import { SearchField } from "@/shared/components/data-display/search-field";
import { EmptyState } from "@/shared/components/feedback/empty-state";
import { ErrorState } from "@/shared/components/feedback/error-state";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { selectPermissions, useAuthStore } from "@/features/auth/store/auth-store";
import { useDebouncedValue } from "@/shared/hooks/use-debounced-value";
import { useMediaQuery } from "@/shared/hooks/use-media-query";
import { money } from "@/shared/lib/format/money";

import { DEFAULT_CLIENT_ORDERING, type ClientFilter } from "../api/clients-crm-api";
import {
  useClientsExport,
  useClientsQuery,
  useDuplicatesQuery,
} from "../hooks/use-clients";
import type { ClientRecord } from "../types/client-record";
import { ClientActionsProvider, useClientActions } from "./client-actions-provider";
import { ClientCard } from "./client-card";
import { ClientDuplicatesDialog } from "./client-duplicates-dialog";
import { ClientImportDialog } from "./client-import-dialog";
import { ClientSegmentChips } from "./client-segment-chips";
import { ClientTableRow, ClientsTableHeader } from "./client-table-row";
import { ClientsFiltersBar } from "./clients-filters-bar";
import { DataQualityDialog } from "./data-quality-dialog";

const PAGE_SIZE = 20;

/**
 * "Mijozlar" — the clinic's client database, and the entry point to everything
 * else: find a person, read their history, and start their next visit, order or
 * treatment without leaving the row.
 */
export function ClientsView() {
  return (
    <ClientActionsProvider>
      <ClientsBody />
    </ClientActionsProvider>
  );
}

function ClientsBody() {
  const router = useRouter();
  const actions = useClientActions();
  const isMobile = useMediaQuery("(max-width: 63.98rem)");
  const permissions = useAuthStore(selectPermissions);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ClientFilter>({
    segment: "all",
    tags: [],
    hasDebt: null,
    isAppUser: null,
    gender: null,
    source: null,
    ordering: DEFAULT_CLIENT_ORDERING,
  });
  const [page, setPage] = useState(1);
  const [duplicatesOpen, setDuplicatesOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [qualityOpen, setQualityOpen] = useState(false);

  const debouncedSearch = useDebouncedValue(search);
  const effectiveFilter = useMemo<ClientFilter>(
    () => ({ ...filter, search: debouncedSearch }),
    [filter, debouncedSearch],
  );

  const list = useClientsQuery(effectiveFilter, page);
  const exportClients = useClientsExport();
  // Only an admin can merge, so only an admin is told there is anything to.
  const duplicates = useDuplicatesQuery(permissions.canMergeClients);
  const duplicateCount = duplicates.data?.length ?? 0;

  function updateFilter(next: ClientFilter) {
    setFilter(next);
    setPage(1);
  }

  function openProfile(client: ClientRecord) {
    // A card with no id exists only as a phone number; the by-phone route is
    // what resolves (or offers to create) it.
    router.push(
      client.id === null ? clientByPhonePath(client.phone) : clientDetailPath(client.id),
    );
  }

  const rows = list.data?.results ?? [];
  const debtors = rows.filter((client) => client.openDebt > 0);
  const debtTotal = debtors.reduce((sum, client) => sum + client.openDebt, 0);

  return (
    <PageContainer className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <SearchField
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder="Ism yoki telefon…"
          className="w-full sm:w-[320px]"
        />

        <div className="ml-auto flex items-center gap-2">
          {permissions.canMergeClients && duplicateCount > 0 && (
            <Button variant="outline" onClick={() => setDuplicatesOpen(true)}>
              <Merge className="size-4" aria-hidden />
              Dublikatlar ({duplicateCount})
            </Button>
          )}

          <Button onClick={() => actions.create()}>
            <UserPlus className="size-4" aria-hidden />
            Yangi mijoz
          </Button>

          {/* Import/export move the whole client base; only an admin sees them. */}
          {permissions.canImport && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Import / Eksport">
                  <MoreHorizontal className="size-4" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => exportClients.mutate(effectiveFilter)}>
                  <Download className="size-4" aria-hidden />
                  Eksport (.xlsx)
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setImportOpen(true)}>
                  <Upload className="size-4" aria-hidden />
                  Import (.xlsx)
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setQualityOpen(true)}>
                  <ShieldCheck className="size-4" aria-hidden />
                  Ma&rsquo;lumot sifati
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <ClientSegmentChips
        value={filter.segment ?? "all"}
        onChange={(segment) => updateFilter({ ...filter, segment })}
      />

      <ClientsFiltersBar filter={filter} onChange={updateFilter} />

      {(list.data?.count ?? 0) > 0 && (
        <p className="text-caption text-text-secondary">
          Jami <span className="tabular">{list.data?.count}</span> ta mijoz
          {debtors.length > 0 && (
            // "On this page" is deliberate: the debt figure is all the loaded
            // rows know, and claiming a base-wide total would be a lie.
            <span className="text-warning">
              {" · "}shu sahifada <span className="tabular">{debtors.length}</span> tasida
              qarz (<span className="tabular">{money.uzs(debtTotal)}</span>)
            </span>
          )}
        </p>
      )}

      <AppCard padded={false} className="overflow-hidden">
        {list.error && !list.data ? (
          <ErrorState error={list.error} onRetry={() => void list.refetch()} />
        ) : list.isPending || !list.data ? (
          <ListSkeleton rows={9} height={58} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Mijoz topilmadi"
            message="Qidiruv yoki filtrni o'zgartiring, yoki yangi mijoz qo'shing."
            action={
              <Button onClick={() => actions.create()}>
                <UserPlus className="size-4" aria-hidden />
                Yangi mijoz
              </Button>
            }
          />
        ) : (
          <>
            {!isMobile && <ClientsTableHeader />}
            <ul
              style={{ opacity: list.isPlaceholderData ? 0.6 : 1 }}
              aria-busy={list.isPlaceholderData}
            >
              {rows.map((client, index) => (
                <li
                  key={client.id ?? client.phone}
                  className={index > 0 ? "border-surface-alt border-t" : undefined}
                >
                  {isMobile ? (
                    <ClientCard
                      client={client}
                      onOpen={() => openProfile(client)}
                      onAction={(action) => actions.run(client, action)}
                    />
                  ) : (
                    <ClientTableRow
                      client={client}
                      onOpen={() => openProfile(client)}
                      onAction={(action) => actions.run(client, action)}
                    />
                  )}
                </li>
              ))}
            </ul>
            <PaginationBar
              page={page}
              pageSize={PAGE_SIZE}
              total={list.data.count}
              onPageChange={setPage}
              busy={list.isFetching}
            />
          </>
        )}
      </AppCard>

      <ClientDuplicatesDialog open={duplicatesOpen} onOpenChange={setDuplicatesOpen} />
      <ClientImportDialog open={importOpen} onOpenChange={setImportOpen} />
      <DataQualityDialog open={qualityOpen} onOpenChange={setQualityOpen} />
    </PageContainer>
  );
}
