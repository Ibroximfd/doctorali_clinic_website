"use client";

import { Check, Save, UserCheck, X } from "lucide-react";
import { useMemo, useState } from "react";

import { ListSkeleton } from "@/shared/components/data-display/list-skeleton";
import { DateFilter } from "@/shared/components/data-display/date-filter";
import { SearchField } from "@/shared/components/data-display/search-field";
import { singleDayRange } from "@/shared/domain/date-presets";
import { StatCard } from "@/shared/components/data-display/stat-card";
import { EmptyState } from "@/shared/components/feedback/empty-state";
import { ErrorState } from "@/shared/components/feedback/error-state";
import { AppCard } from "@/shared/components/data-display/app-card";
import { AppAvatar } from "@/shared/components/ui/app-avatar";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  dayMonthYear,
  hhmm,
  isToday,
  nowTashkent,
  startOfDay,
  weekdayUz,
  type TashkentDate,
} from "@/shared/lib/format/date";
import { percent } from "@/shared/lib/format/percent";
import { useResetOnChange } from "@/shared/hooks/use-reset-on-change";
import { cn } from "@/shared/lib/utils";

import { useSaveMarks, useSheetQuery } from "../hooks/use-attendance";
import {
  ATTENDANCE_STATUS_LABEL,
  attendanceRate,
  countsFromStatuses,
  employeePhonePretty,
  type AttendanceEntry,
  type AttendanceStatus,
} from "../types/attendance";

/**
 * "Kunlik yo'qlama" — the roll-call sheet.
 *
 * Marks are held locally until Saqlash, and saved in ONE all-or-nothing
 * request. That is deliberate: a busy morning is a burst of taps, and a request
 * per tap would half-save the sheet the moment the link stutters.
 *
 * The search filters the LOADED sheet in memory rather than re-querying, so a
 * row that is marked but not yet saved never jumps out from under the cursor.
 */
export function AttendanceSheetView() {
  const [date, setDate] = useState<TashkentDate | null>(null);
  const [search, setSearch] = useState("");
  /** employeeId → the mark the desk has made but not yet saved. */
  const [pending, setPending] = useState<
    Record<string, { status: AttendanceStatus; note: string }>
  >({});

  const { data: sheet, error, isPending, refetch } = useSheetQuery(date);
  const save = useSaveMarks();

  // A different day is a different sheet; carrying edits across would save them
  // against the wrong date.
  useResetOnChange(date?.getTime() ?? null, () => setPending({}));

  const rows = useMemo(() => {
    if (!sheet) return [];
    const query = search.trim().toLowerCase();
    const matched = query
      ? sheet.entries.filter(
          (entry) =>
            entry.employee.fullName.toLowerCase().includes(query) ||
            entry.employee.position.toLowerCase().includes(query),
        )
      : sheet.entries;
    return matched;
  }, [sheet, search]);

  /** The status on screen: the unsaved mark when there is one, else the server's. */
  function statusOf(entry: AttendanceEntry): AttendanceStatus {
    return pending[entry.employee.id]?.status ?? entry.status;
  }
  function noteOf(entry: AttendanceEntry): string {
    return pending[entry.employee.id]?.note ?? entry.note;
  }

  const liveCounts = useMemo(
    () =>
      sheet
        ? countsFromStatuses(sheet.entries.map(statusOf))
        : { present: 0, absent: 0, unmarked: 0 },
    // `pending` changes the derived statuses, so it belongs in the deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sheet, pending],
  );

  const dirtyCount = Object.keys(pending).length;

  function mark(entry: AttendanceEntry, status: AttendanceStatus) {
    setPending((prev) => {
      const next = { ...prev };
      // Tapping the status a row already has takes the mark back off.
      const effective = statusOf(entry) === status ? "unmarked" : status;
      if (effective === entry.status) delete next[entry.employee.id];
      else next[entry.employee.id] = { status: effective, note: noteOf(entry) };
      return next;
    });
  }

  function setNote(entry: AttendanceEntry, note: string) {
    setPending((prev) => ({
      ...prev,
      [entry.employee.id]: { status: statusOf(entry), note },
    }));
  }

  async function submit() {
    const items = Object.entries(pending).map(([employeeId, mark]) => ({
      employeeId,
      status: mark.status,
      note: mark.note,
    }));
    if (items.length === 0) return;
    await save.mutateAsync({ items, date });
    setPending({});
  }

  const shown = date ?? startOfDay(nowTashkent());

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {/* The same date control as every other page, in its single-day mode:
            ‹ › walk the sheet day by day, and the calendar jumps to a distant
            one without twenty clicks. */}
        <DateFilter
          value={singleDayRange(shown)}
          onChange={(next) => next && setDate(next.start)}
          clearable={false}
        />
        <span className="text-caption text-text-tertiary">
          {dayMonthYear(shown)} · {isToday(shown) ? "Bugun" : weekdayUz(shown)}
        </span>

        {!isToday(shown) && (
          <Button variant="outline" onClick={() => setDate(null)}>
            Bugunga qaytish
          </Button>
        )}

        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Xodim ismi…"
          className="w-full sm:w-[240px]"
        />

        <div className="flex-1" />

        <Button onClick={submit} disabled={dirtyCount === 0 || save.isPending}>
          {save.isPending ? (
            <span
              className="border-primary-foreground/40 border-t-primary-foreground size-4 animate-spin rounded-full border-2"
              aria-hidden
            />
          ) : (
            <Save className="size-4" aria-hidden />
          )}
          {dirtyCount > 0 ? `Saqlash (${dirtyCount})` : "Saqlash"}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Keldi"
          value={String(liveCounts.present)}
          icon={Check}
          tone="primary"
        />
        <StatCard
          label="Kelmadi"
          value={String(liveCounts.absent)}
          icon={X}
          tone="danger"
        />
        <StatCard
          label="Belgilanmagan"
          value={String(liveCounts.unmarked)}
          icon={UserCheck}
          tone="neutral"
        />
        <StatCard
          label="Davomat"
          value={percent.labeled(Math.round(attendanceRate(liveCounts) * 10) / 10)}
          icon={UserCheck}
          tone="info"
        />
      </div>

      <AppCard padded={false} className="overflow-hidden">
        {error && !sheet ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : isPending || !sheet ? (
          <ListSkeleton rows={8} height={62} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={UserCheck}
            title="Xodim topilmadi"
            message={
              sheet.entries.length === 0
                ? "Roʻyxatga xodim qoʻshilmagan."
                : "Qidiruvni tozalang."
            }
          />
        ) : (
          <ul>
            {rows.map((entry, index) => (
              <li
                key={entry.employee.id}
                className={index > 0 ? "border-surface-alt border-t" : undefined}
              >
                <AttendanceRow
                  entry={entry}
                  status={statusOf(entry)}
                  note={noteOf(entry)}
                  dirty={entry.employee.id in pending}
                  onMark={(status) => mark(entry, status)}
                  onNote={(note) => setNote(entry, note)}
                />
              </li>
            ))}
          </ul>
        )}
      </AppCard>
    </div>
  );
}

function AttendanceRow({
  entry,
  status,
  note,
  dirty,
  onMark,
  onNote,
}: {
  entry: AttendanceEntry;
  status: AttendanceStatus;
  note: string;
  dirty: boolean;
  onMark: (status: AttendanceStatus) => void;
  onNote: (note: string) => void;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3",
        dirty && "bg-primary-soft/25",
      )}
    >
      <AppAvatar name={entry.employee.fullName} size={36} />

      <div className="min-w-[10rem] flex-1">
        <p className="text-title-sm truncate">{entry.employee.fullName}</p>
        <p className="text-caption text-text-tertiary tabular truncate">
          {entry.employee.position || "Lavozim ko'rsatilmagan"}
          {entry.employee.phone && ` · ${employeePhonePretty(entry.employee)}`}
        </p>
      </div>

      {status === "absent" && (
        <Input
          value={note}
          onChange={(event) => onNote(event.target.value)}
          placeholder="Sabab (Kasal, Ta'tilda…)"
          aria-label={`${entry.employee.fullName} — sabab`}
          className="h-9 w-full sm:w-[220px]"
        />
      )}

      {entry.markedAt && !dirty && (
        <span className="text-caption text-text-tertiary tabular hidden lg:block">
          {hhmm(entry.markedAt)}
          {entry.markedBy && ` · ${entry.markedBy}`}
        </span>
      )}

      <div role="radiogroup" aria-label="Holat" className="flex shrink-0 gap-1">
        <MarkButton
          selected={status === "present"}
          tone="present"
          onClick={() => onMark("present")}
        >
          <Check className="size-4" aria-hidden />
          {ATTENDANCE_STATUS_LABEL.present}
        </MarkButton>
        <MarkButton
          selected={status === "absent"}
          tone="absent"
          onClick={() => onMark("absent")}
        >
          <X className="size-4" aria-hidden />
          {ATTENDANCE_STATUS_LABEL.absent}
        </MarkButton>
      </div>
    </div>
  );
}

function MarkButton({
  children,
  selected,
  tone,
  onClick,
}: {
  children: React.ReactNode;
  selected: boolean;
  tone: "present" | "absent";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        "text-label-sm flex h-9 items-center gap-1.5 rounded-sm border px-3 transition-colors",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
        selected
          ? tone === "present"
            ? "border-primary bg-primary-soft text-primary-dark"
            : "border-danger bg-danger/12 text-danger"
          : "border-border bg-surface text-text-secondary hover:bg-surface-hover",
      )}
    >
      {children}
    </button>
  );
}
