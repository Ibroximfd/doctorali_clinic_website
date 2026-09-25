import { tashkentFromApi, type TashkentDate } from "@/shared/lib/format/date";
import { parseFilialRef, type FilialRef } from "@/shared/domain/filial";

/** A dated note left on a client card by whoever was at the desk. */
export interface ClientNote {
  /** Branch the record was made in; null on an older payload. */
  readonly filial: FilialRef | null;
  readonly id: string;
  readonly text: string;
  /** Who wrote it, so reception knows whom to ask about it. */
  readonly author: string;
  readonly createdAt: TashkentDate;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

export function parseClientNote(raw: unknown): ClientNote {
  const n = isRecord(raw) ? raw : {};
  const createdBy = n.created_by;
  const author =
    n.author !== null && n.author !== undefined
      ? String(n.author)
      : isRecord(createdBy)
        ? String(createdBy.full_name ?? "")
        : "";
  return {
    filial: parseFilialRef(n.filial),
    id: String(n.id ?? ""),
    text: String(n.text ?? ""),
    author,
    createdAt: tashkentFromApi(String(n.created_at ?? "")),
  };
}
