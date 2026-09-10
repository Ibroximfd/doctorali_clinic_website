import { parseClientRecord, type ClientRecord } from "./client-record";

/**
 * Two cards the backend believes are the same person.
 *
 * Whether they really are is a judgement call the admin makes, which is why
 * this only ever describes a *candidate*: merging is a separate, explicitly
 * confirmed action.
 */
export interface DuplicatePair {
  /** The card the backend suggests keeping (usually the older, richer one). */
  readonly primary: ClientRecord;
  readonly duplicate: ClientRecord;
  /** Why they were flagged — matching name, similar phone, and so on. */
  readonly reason: string;
  /** Similarity 0..1, when the backend reports one. */
  readonly score: number;
}

/** What the merged card would end up with — the preview before committing. */
export function mergePreview(pair: DuplicatePair) {
  return {
    visits: pair.primary.visitsCount + pair.duplicate.visitsCount,
    orders: pair.primary.ordersCount + pair.duplicate.ordersCount,
    ordersTotal: pair.primary.ordersTotal + pair.duplicate.ordersTotal,
    openDebt: pair.primary.openDebt + pair.duplicate.openDebt,
  };
}

/**
 * `GET alerts/data-quality/` — how clean the client base is.
 *
 * Every number is a to-do: duplicate groups to merge, cards with no name or
 * birth date to fill in, phones that cannot receive anything.
 */
export interface DataQualityReport {
  readonly duplicateGroups: number;
  readonly duplicateNames: readonly string[];
  readonly nameless: number;
  readonly noBirthDate: number;
  readonly invalidPhone: number;
  readonly totalClients: number;
}

export function isClean(report: DataQualityReport): boolean {
  return (
    report.duplicateGroups === 0 && report.nameless === 0 && report.invalidPhone === 0
  );
}

/** One row the importer could not accept. */
export interface ClientImportError {
  /** 1-based spreadsheet row, so the admin can go fix it. */
  readonly row: number;
  readonly message: string;
}

/**
 * Outcome of `POST clients/import/`.
 *
 * The dry run and the real run answer the same shape — which is the point: the
 * admin sees exactly what will happen, then re-sends the identical file with
 * `dry_run=false` to make it happen.
 */
export interface ClientImportReport {
  readonly total: number;
  readonly created: number;
  readonly updated: number;
  readonly skipped: number;
  readonly errors: readonly ClientImportError[];
  /** True when nothing was written — a preview. */
  readonly dryRun: boolean;
}

/** Rows that would actually change something. */
export function affectedRows(report: ClientImportReport): number {
  return report.created + report.updated;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}
function num(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}
function str(v: unknown, fallback = ""): string {
  return v === null || v === undefined ? fallback : String(v);
}

export function parseDuplicatePair(raw: unknown): DuplicatePair {
  const p = isRecord(raw) ? raw : {};
  return {
    primary: parseClientRecord(p.primary),
    duplicate: parseClientRecord(p.duplicate),
    reason: str(p.reason),
    score: num(p.score),
  };
}

export function parseDataQualityReport(raw: unknown): DataQualityReport {
  const r = isRecord(raw) ? raw : {};
  return {
    duplicateGroups: num(r.duplicate_groups),
    duplicateNames: Array.isArray(r.duplicate_names)
      ? r.duplicate_names
          .filter((n) => n !== null && n !== undefined && String(n).trim() !== "")
          .map((n) => String(n))
      : [],
    nameless: num(r.nameless),
    noBirthDate: num(r.no_birth_date),
    invalidPhone: num(r.invalid_phone),
    totalClients: num(r.total_clients),
  };
}

export function parseClientImportReport(
  raw: unknown,
  dryRun: boolean,
): ClientImportReport {
  const r = isRecord(raw) ? raw : {};
  return {
    total: num(r.total),
    created: num(r.created),
    updated: num(r.updated),
    skipped: num(r.skipped),
    errors: Array.isArray(r.errors)
      ? r.errors
          .filter(isRecord)
          .map((e) => ({ row: num(e.row), message: str(e.message) }))
      : [],
    dryRun,
  };
}
