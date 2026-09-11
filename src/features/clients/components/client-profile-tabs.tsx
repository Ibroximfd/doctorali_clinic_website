"use client";

import { Inbox } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";

import { AppointmentStatusChip } from "@/features/appointments/components/appointment-status-chip";
import { appointmentPurposeLabel } from "@/features/appointments/types/appointment";
import { DebtStatusBadge } from "@/features/debts/components/debt-status-badge";
import { OrderEditDialog } from "@/features/new-order/components/order-edit-dialog";
import { OrderDetailDialog } from "@/features/orders/components/order-detail-dialog";
import type { OrderDetail } from "@/features/orders/types/order";
import { EmptyState } from "@/shared/components/feedback/empty-state";
import { ErrorState } from "@/shared/components/feedback/error-state";
import { PaginationBar } from "@/shared/components/data-display/pagination-bar";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { dayMonthYear, shortDate, shortDateTime } from "@/shared/lib/format/date";
import { money } from "@/shared/lib/format/money";
import { cn } from "@/shared/lib/utils";

import {
  useClientDebtsTab,
  useClientNotesTab,
  useClientNotificationsTab,
  useClientOrdersTab,
  useClientTreatmentsTab,
  useClientVisitsTab,
} from "../hooks/use-client-profile";
import type { ClientProfile } from "../types/client-profile";
import {
  needsCall,
  notificationStatusLabel,
  type NotificationLog,
} from "../types/notification-log";
import { ClientTimeline } from "./client-timeline";

const PAGE_SIZE = 20;

const TABS = [
  "timeline",
  "visits",
  "orders",
  "treatments",
  "debts",
  "notes",
  "messages",
] as const;
type ProfileTab = (typeof TABS)[number];

const TAB_LABEL: Readonly<Record<ProfileTab, string>> = {
  timeline: "Tarix",
  visits: "Tashriflar",
  orders: "Buyurtmalar",
  treatments: "Muolajalar",
  debts: "Qarzlar",
  notes: "Izohlar",
  messages: "Xabarlar",
};

/**
 * The tab strip of the 360° card, with each tab's own list under it.
 *
 * Counts sit next to the labels because the count is often the whole answer —
 * reception can see there are three orders without opening the tab.
 */
export function ClientProfileTabs({
  profile,
  clientId,
}: {
  profile: ClientProfile;
  clientId: number;
}) {
  const [active, setActive] = useState<ProfileTab>("timeline");

  /** Prefer the summary's authoritative totals; fall back to what is loaded. */
  const counts: Readonly<Record<ProfileTab, number | null>> = {
    timeline: null,
    visits: profile.summary.visitsCount,
    orders: profile.summary.ordersCount,
    treatments: profile.summary.treatmentsCount + profile.summary.consultationsCount,
    debts: profile.debts.length,
    notes: profile.notes.length,
    // Loaded lazily from its own endpoint — no count to promise up front.
    messages: null,
  };

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Mijoz kartasi" className="flex flex-wrap gap-1.5">
        {TABS.map((tab) => {
          const selected = active === tab;
          const count = counts[tab];
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActive(tab)}
              className={cn(
                "text-label-sm inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 transition-colors",
                "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                selected
                  ? "border-primary bg-primary-soft text-primary-dark"
                  : "border-border bg-surface text-text-secondary hover:bg-surface-hover",
              )}
            >
              {TAB_LABEL[tab]}
              {count !== null && count > 0 && (
                <span className="text-label-xs tabular opacity-70">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {active === "timeline" && <ClientTimeline clientId={clientId} />}
      {active === "visits" && <VisitsTab clientId={clientId} />}
      {active === "orders" && <OrdersTab clientId={clientId} />}
      {active === "treatments" && <TreatmentsTab clientId={clientId} />}
      {active === "debts" && <DebtsTab clientId={clientId} />}
      {active === "notes" && <NotesTab clientId={clientId} />}
      {active === "messages" && <MessagesTab clientId={clientId} />}
    </div>
  );
}

/**
 * The shell every tab shares: skeleton, error, empty, rows, pagination.
 *
 * Written once so a tab differs only in the endpoint it reads and the row it
 * renders — the part that actually varies.
 */
function TabList<T>({
  query,
  page,
  onPageChange,
  emptyTitle,
  renderRow,
  rowKey,
}: {
  query: {
    data?: { count: number; results: readonly T[] };
    error: unknown;
    isPending: boolean;
    /** True only while the PREVIOUS page's rows are still on screen. */
    isPlaceholderData: boolean;
    refetch: () => unknown;
  };
  page: number;
  onPageChange: (page: number) => void;
  emptyTitle: string;
  renderRow: (item: T) => ReactNode;
  rowKey: (item: T) => string;
}) {
  if (query.error && !query.data) {
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  }
  if (query.isPending || !query.data) {
    return (
      <div className="flex flex-col gap-2" aria-hidden>
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-14 rounded-sm" />
        ))}
      </div>
    );
  }
  if (query.data.results.length === 0) {
    return <EmptyState icon={Inbox} title={emptyTitle} />;
  }

  return (
    <div className="flex flex-col">
      <ul
        className="divide-border/60 border-border divide-y rounded-md border"
        style={{ opacity: query.isPlaceholderData ? 0.6 : 1 }}
        aria-busy={query.isPlaceholderData}
      >
        {query.data.results.map((item) => (
          <li key={rowKey(item)} className="px-3 py-2.5">
            {renderRow(item)}
          </li>
        ))}
      </ul>
      <PaginationBar
        page={page}
        pageSize={PAGE_SIZE}
        total={query.data.count}
        onPageChange={onPageChange}
        busy={query.isPlaceholderData}
      />
    </div>
  );
}

function VisitsTab({ clientId }: { clientId: number }) {
  const [page, setPage] = useState(1);
  const query = useClientVisitsTab(clientId, page);
  return (
    <TabList
      query={query}
      page={page}
      onPageChange={setPage}
      emptyTitle="Tashrif yo'q"
      rowKey={(visit) => visit.id}
      renderRow={(visit) => (
        <div className="flex items-center gap-3">
          <span className="min-w-0 flex-1">
            <span className="text-title-sm tabular block truncate">
              {shortDateTime(visit.scheduledAt)}
            </span>
            <span className="text-caption text-text-tertiary block truncate">
              {appointmentPurposeLabel(visit)}
              {visit.doctor && ` · ${visit.doctor.fullName}`}
            </span>
          </span>
          <AppointmentStatusChip
            status={visit.status}
            statusDisplay={visit.statusDisplay}
          />
        </div>
      )}
    />
  );
}

function OrdersTab({ clientId }: { clientId: number }) {
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editing, setEditing] = useState<OrderDetail | null>(null);
  const query = useClientOrdersTab(clientId, page);

  return (
    <>
      <TabList
        query={query}
        page={page}
        onPageChange={setPage}
        emptyTitle="Buyurtma yo'q"
        rowKey={(order) => order.id}
        renderRow={(order) => (
          /*
           * The sale opens HERE, on the card it belongs to. Sending the desk to
           * the orders page with a search term made them lose the client they
           * were looking at to read one line of their history.
           */
          <button
            type="button"
            onClick={() => setDetailId(order.id)}
            className="hover:bg-surface-hover focus-visible:ring-ring -mx-3 -my-2.5 flex w-[calc(100%+1.5rem)] items-center gap-3 rounded-sm px-3 py-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <span className="min-w-0 flex-1">
              <span className="text-title-sm tabular block truncate">
                {order.orderNumber}
              </span>
              <span className="text-caption text-text-tertiary tabular block truncate">
                {shortDateTime(order.createdAt)}
                {order.doctorName !== "" && ` · ${order.doctorName}`}
              </span>
            </span>
            <span
              className={cn(
                "text-title-sm tabular shrink-0",
                order.status === "cancelled" && "text-text-tertiary line-through",
              )}
            >
              {money.plain(order.totalAmount)}
            </span>
          </button>
        )}
      />

      <OrderDetailDialog
        orderId={detailId}
        open={detailId !== null}
        onOpenChange={(open) => !open && setDetailId(null)}
        onEdit={(order) => {
          setDetailId(null);
          setEditing(order);
        }}
      />

      <OrderEditDialog
        order={editing}
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
      />
    </>
  );
}

function TreatmentsTab({ clientId }: { clientId: number }) {
  const [page, setPage] = useState(1);
  const query = useClientTreatmentsTab(clientId, page);
  return (
    <TabList
      query={query}
      page={page}
      onPageChange={setPage}
      emptyTitle="Muolaja yo'q"
      rowKey={(treatment) => treatment.id}
      renderRow={(treatment) => (
        <div className="flex items-center gap-3">
          <span className="min-w-0 flex-1">
            <span className="text-title-sm block truncate">
              {treatment.description || treatment.kindDisplay}
            </span>
            <span className="text-caption text-text-tertiary tabular block truncate">
              {shortDateTime(treatment.performedAt)}
              {treatment.doctor && ` · ${treatment.doctor.fullName}`}
            </span>
          </span>
          <span
            className={cn(
              "text-title-sm tabular shrink-0",
              treatment.status === "cancelled" && "text-text-tertiary line-through",
            )}
          >
            {money.plain(treatment.amount)}
          </span>
        </div>
      )}
    />
  );
}

function DebtsTab({ clientId }: { clientId: number }) {
  const [page, setPage] = useState(1);
  const query = useClientDebtsTab(clientId, page);
  return (
    <TabList
      query={query}
      page={page}
      onPageChange={setPage}
      emptyTitle="Qarz yo'q"
      rowKey={(debt) => debt.id}
      renderRow={(debt) => (
        <div className="flex items-center gap-3">
          <span className="min-w-0 flex-1">
            <span className="text-title-sm tabular block truncate">
              {money.plain(debt.remaining)}{" "}
              <span className="text-caption text-text-tertiary">
                / {money.plain(debt.amount)}
              </span>
            </span>
            <span className="text-caption text-text-tertiary tabular block truncate">
              {dayMonthYear(debt.dueDate)}
              {debt.sourceDisplay !== "" && ` · ${debt.sourceDisplay}`}
            </span>
          </span>
          <DebtStatusBadge debt={debt} />
        </div>
      )}
    />
  );
}

function NotesTab({ clientId }: { clientId: number }) {
  const [page, setPage] = useState(1);
  const query = useClientNotesTab(clientId, page);
  return (
    <TabList
      query={query}
      page={page}
      onPageChange={setPage}
      emptyTitle="Izoh yo'q"
      rowKey={(note) => note.id}
      renderRow={(note) => (
        <div>
          <p className="text-body-sm break-words">{note.text}</p>
          <p className="text-caption text-text-tertiary tabular">
            {shortDate(note.createdAt)}
            {note.author !== "" && ` · ${note.author}`}
          </p>
        </div>
      )}
    />
  );
}

function MessagesTab({ clientId }: { clientId: number }) {
  const [page, setPage] = useState(1);
  const query = useClientNotificationsTab(clientId, page);
  return (
    <TabList
      query={query}
      page={page}
      onPageChange={setPage}
      emptyTitle="Xabar yuborilmagan"
      rowKey={(log) => String(log.id)}
      renderRow={(log) => <MessageRow log={log} />}
    />
  );
}

function MessageRow({ log }: { log: NotificationLog }) {
  return (
    <div className="flex items-start gap-3">
      <span className="min-w-0 flex-1">
        <span className="text-title-sm block truncate">{log.title}</span>
        {log.body !== "" && (
          <span className="text-caption text-text-secondary block truncate">
            {log.body}
          </span>
        )}
        <span className="text-caption text-text-tertiary tabular block">
          {shortDateTime(log.sentAt ?? log.createdAt)}
          {log.channelDisplay !== "" && ` · ${log.channelDisplay}`}
        </span>
        {/* A message that never arrived is reception's cue to call, so the
            reason is shown rather than hidden behind the status word. */}
        {log.error !== "" && (
          <span className="text-caption text-danger block">{log.error}</span>
        )}
      </span>
      <span
        className={cn(
          "text-label-xs shrink-0 rounded-full px-2 py-0.5",
          log.status === "sent"
            ? "bg-success/12 text-success"
            : needsCall(log.status)
              ? "bg-danger/12 text-danger"
              : "bg-surface-alt text-text-tertiary",
        )}
      >
        {notificationStatusLabel(log)}
      </span>
    </div>
  );
}
