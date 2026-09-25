/**
 * The branch a record belongs to (`filial: {id, name}`).
 *
 * The clinic runs more than one branch (Toshkent, Qo'qon) and every desk
 * account is tied to exactly one: the server scopes every list to it, so the
 * app never picks a branch — it only names the one a row came from.
 */
export interface FilialRef {
  readonly id: number;
  readonly name: string;
}

/** The signed-in account's own branch (`user.filial` on login / me). */
export interface UserFilial extends FilialRef {
  readonly region: string;
  readonly isMain: boolean;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/**
 * Null when the payload names no branch — an older server, or a record made
 * before branches existed. A nameless object is treated the same: an empty tag
 * says nothing the desk can use.
 */
export function parseFilialRef(raw: unknown): FilialRef | null {
  if (!isRecord(raw)) return null;
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (name === "") return null;
  return { id: typeof raw.id === "number" ? raw.id : 0, name };
}

export function parseUserFilial(raw: unknown): UserFilial | null {
  const ref = parseFilialRef(raw);
  if (ref === null || !isRecord(raw)) return null;
  return {
    ...ref,
    region: typeof raw.region === "string" ? raw.region : "",
    isMain: raw.is_main === true,
  };
}
