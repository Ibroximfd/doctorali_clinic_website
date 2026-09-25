import { parseUserFilial } from "@/shared/domain/filial";
import { endpoints } from "@/shared/lib/api/endpoints";
import { http } from "@/shared/lib/api/http";

import type { AuthSession, AuthUser, UserPermissions } from "../types/auth-user";
import { NO_PERMISSIONS } from "../types/auth-user";

// --- Parsers ----------------------------------------------------------------

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function str(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

/**
 * Every flag defaults to **false**: an older backend that doesn't send the
 * block yet simply hides the privileged buttons rather than offering actions
 * the server would reject. `canBackdate` / `canDelete` default to **true** —
 * they gate features the desk already uses, and an older payload must not
 * silently take them away.
 */
export function parsePermissions(raw: unknown): UserPermissions {
  if (typeof raw !== "object" || raw === null) return NO_PERMISSIONS;
  const p = raw as Record<string, unknown>;
  return {
    canMergeClients: bool(p.can_merge_clients, false),
    canCancelOld: bool(p.can_cancel_old, false),
    canWriteOffDebt: bool(p.can_write_off_debt, false),
    canImport: bool(p.can_import, false),
    canBlockClients: bool(p.can_block_clients, false),
    canAnonymize: bool(p.can_anonymize, false),
    canBackdate: bool(p.can_backdate, true),
    canDelete: bool(p.can_delete, true),
  };
}

export function parseAuthUser(raw: unknown): AuthUser {
  const u = (raw ?? {}) as Record<string, unknown>;
  return {
    id: typeof u.id === "number" ? u.id : Number(u.id ?? 0),
    phone: str(u.phone),
    username: str(u.username),
    role: str(u.role),
    fullName: str(u.full_name),
    isReception: bool(u.is_reception, false),
    isAdmin: bool(u.is_admin, false),
    avatarUrl: typeof u.avatar_url === "string" ? u.avatar_url : null,
    permissions: parsePermissions(u.permissions),
    filial: parseUserFilial(u.filial),
  };
}

// --- Calls ------------------------------------------------------------------

/**
 * `POST auth/login/`. Only accounts with `is_reception=true` succeed; the
 * backend's Uzbek 403 message is surfaced as-is.
 */
export async function login(credentials: {
  username: string;
  password: string;
}): Promise<AuthSession> {
  const data = await http.post<{
    access: string;
    refresh: string;
    user: unknown;
  }>(endpoints.login, { json: credentials });
  return {
    access: data.access,
    refresh: data.refresh,
    user: parseAuthUser(data.user),
  };
}

/** `GET auth/me/` — validates the stored session and returns the current user. */
export async function fetchMe(signal?: AbortSignal): Promise<AuthUser> {
  const data = await http.get<unknown>(endpoints.me, { signal });
  return parseAuthUser(data);
}
