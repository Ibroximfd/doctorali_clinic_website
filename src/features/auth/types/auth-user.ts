/**
 * The signed-in reception account (`auth/login/` and `auth/me/`), plus the
 * permission flags that decide which privileged buttons exist at all.
 */

/**
 * What this account may do beyond everyday reception work (backend §13.1),
 * delivered inside `auth/me/` as a `permissions` block.
 *
 * The UI **hides** a forbidden action rather than disabling it — a greyed-out
 * button reads as "broken" at the desk.
 */
export interface UserPermissions {
  /** Merge two client cards into one (irreversible → admin only). */
  readonly canMergeClients: boolean;
  /**
   * The server's exemption from the PIN gate on an older record.
   *
   * The key kept its name (`can_cancel_old`) but its meaning changed on
   * 2026-09-02: touching an older record is no longer forbidden for anyone —
   * it is gated by the 4-digit PIN, and this flag says the server will let this
   * account through without one.
   *
   * **The app deliberately does not act on it**: the desk asked for the PIN on
   * every out-of-today change, whoever is signed in. Parsed all the same, so
   * honouring it again is a one-line change here rather than a backend release.
   */
  readonly canCancelOld: boolean;
  /** Write a debt off (`debts/{id}/cancel/`). */
  readonly canWriteOffDebt: boolean;
  /** Import the client base from a spreadsheet. */
  readonly canImport: boolean;
  /** Block / unblock a client card. */
  readonly canBlockClients: boolean;
  /** "Forget" a client (anonymize the card, keep the money records). */
  readonly canAnonymize: boolean;
  /**
   * May file a sale or a service under an earlier day.
   *
   * Unlike the flags above this defaults to **true**: it gates a feature the
   * desk already uses, and an older payload that omits it must not silently
   * take it away. The server refuses regardless, with a readable message.
   */
  readonly canBackdate: boolean;
  /** May erase an order or a service outright (`DELETE`). Same default. */
  readonly canDelete: boolean;
}

export const NO_PERMISSIONS: UserPermissions = {
  canMergeClients: false,
  canCancelOld: false,
  canWriteOffDebt: false,
  canImport: false,
  canBlockClients: false,
  canAnonymize: false,
  canBackdate: true,
  canDelete: true,
};

export interface AuthUser {
  readonly id: number;
  readonly phone: string;
  readonly username: string;
  readonly role: string;
  readonly fullName: string;
  readonly isReception: boolean;
  /** Reception admin (doc §2) — the coarse marker for "show admin areas at all". */
  readonly isAdmin: boolean;
  readonly avatarUrl: string | null;
  readonly permissions: UserPermissions;
}

/** Tokens plus the user, as `auth/login/` returns them. */
export interface AuthSession {
  readonly access: string;
  readonly refresh: string;
  readonly user: AuthUser;
}
