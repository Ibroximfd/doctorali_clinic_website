import { tashkentFromApi, type TashkentDate } from "@/shared/lib/format/date";

/** A dated note left on a client card by whoever was at the desk. */
export interface ClientNote {
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
    id: String(n.id ?? ""),
    text: String(n.text ?? ""),
    author,
    createdAt: tashkentFromApi(String(n.created_at ?? "")),
  };
}
