/**
 * The typed error every repository surfaces — ported from Flutter's
 * `ApiException`.
 *
 * The reception API answers failures with one uniform envelope:
 *
 * ```json
 * { "error": { "code": "validation_error",
 *              "message": "O'zbekcha xabar",
 *              "fields": { "client_phone": ["..."] } } }
 * ```
 *
 * `message` is written for the desk and is shown verbatim — the app never
 * composes its own sentence for a server refusal.
 */

/** Machine codes the app branches on. Anything else is passed through as-is. */
export type ApiErrorCode =
  | "validation_error"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "server_error"
  | "network"
  | "insufficient_stock"
  | "payments_mismatch"
  | "pin_required"
  | "pin_locked"
  | "total_override_not_applicable"
  | "gift_not_allowed"
  | "stock_would_go_negative"
  | "packaging_price_conflict"
  | (string & {});

/** Per-field validation messages: form field name → messages. */
export type FieldErrors = Readonly<Record<string, readonly string[]>>;

/**
 * One structured line of an `insufficient_stock` refusal (`fields.items[]`).
 * All quantities are base units (dona), whatever unit the line was sent in.
 */
export interface StockIssue {
  /** The `product_id` exactly as sent — the key to find the cart line. */
  readonly productId: number;
  /** What the shelf really holds right now. */
  readonly available: number;
  /** What the refused line asked for. */
  readonly requested: number;
}

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly fieldErrors: FieldErrors;
  readonly stockIssues: readonly StockIssue[];
  readonly status: number | null;
  /** True when there was no HTTP response at all (timeout / offline / CORS). */
  readonly isNetwork: boolean;

  constructor(init: {
    code: ApiErrorCode;
    message: string;
    fieldErrors?: FieldErrors;
    stockIssues?: readonly StockIssue[];
    status?: number | null;
    isNetwork?: boolean;
  }) {
    super(init.message);
    this.name = "ApiError";
    this.code = init.code;
    this.fieldErrors = init.fieldErrors ?? {};
    this.stockIssues = init.stockIssues ?? [];
    this.status = init.status ?? null;
    this.isNetwork = init.isNetwork ?? false;
  }

  get isUnauthorized(): boolean {
    return this.status === 401 || this.code === "unauthorized";
  }
  get isForbidden(): boolean {
    return this.status === 403 || this.code === "forbidden";
  }
  get isNotFound(): boolean {
    return this.status === 404 || this.code === "not_found";
  }
  /** 429 after too many wrong PIN attempts — the server's message names the wait. */
  get isRateLimited(): boolean {
    return this.status === 429;
  }

  /** First message for `field`, if any. */
  fieldError(field: string): string | undefined {
    return this.fieldErrors[field]?.[0];
  }

  static is(error: unknown): error is ApiError {
    return error instanceof ApiError;
  }
}

/** The offline / blocked-CORS case: no response ever arrived. */
export function networkError(): ApiError {
  return new ApiError({
    code: "network",
    message: "Internet bilan aloqa yo'q. Qayta urinib ko'ring",
    isNetwork: true,
  });
}

const MESSAGE_FOR_STATUS: Readonly<Record<number, string>> = {
  400: "Kiritilgan ma'lumot noto'g'ri",
  401: "Avtorizatsiya talab qilinadi",
  403: "Ruxsat yo'q",
  404: "Ma'lumot topilmadi",
};

const CODE_FOR_STATUS: Readonly<Record<number, ApiErrorCode>> = {
  400: "validation_error",
  401: "unauthorized",
  403: "forbidden",
  404: "not_found",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Renders one `fields.items[]` entry as a sentence. Faza 2 sends structured
 * maps here; a raw `{product_id: ...}` dump must never reach the screen.
 */
function describeEntry(entry: Record<string, unknown>): string {
  const message = entry.message;
  if (typeof message === "string" && message !== "") return message;

  const available = typeof entry.available === "number" ? entry.available : null;
  if (available !== null) {
    const requested = typeof entry.requested === "number" ? entry.requested : null;
    return (
      `Omborda yetarli emas: qoldiq ${available} dona` +
      (requested === null ? "" : `, kerak: ${requested} dona`)
    );
  }
  return "Kiritilgan ma'lumot noto'g'ri";
}

function parseFieldErrors(raw: unknown): FieldErrors {
  if (!isRecord(raw)) return {};
  const out: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (Array.isArray(value)) {
      out[key] = value.map((entry) =>
        isRecord(entry) ? describeEntry(entry) : String(entry),
      );
    } else if (value !== null && value !== undefined) {
      out[key] = [String(value)];
    }
  }
  return out;
}

/**
 * Tolerant parse: anything without the two load-bearing numbers is not a
 * structured issue (an older backend, a plain string) and is skipped.
 */
function parseStockIssues(raw: unknown): StockIssue[] {
  if (!isRecord(raw) || !Array.isArray(raw.items)) return [];
  const issues: StockIssue[] = [];
  for (const item of raw.items) {
    if (!isRecord(item)) continue;
    const productId = typeof item.product_id === "number" ? item.product_id : null;
    const available = typeof item.available === "number" ? item.available : null;
    if (productId === null || available === null) continue;
    issues.push({
      productId,
      available,
      requested: typeof item.requested === "number" ? item.requested : 0,
    });
  }
  return issues;
}

/** Builds an {@link ApiError} from a response body the server sent. */
export function apiErrorFromBody(status: number, body: unknown): ApiError {
  if (isRecord(body) && isRecord(body.error)) {
    const err = body.error;
    return new ApiError({
      code: typeof err.code === "string" ? err.code : "server_error",
      message: typeof err.message === "string" ? err.message : "Xatolik yuz berdi",
      fieldErrors: parseFieldErrors(err.fields),
      stockIssues: parseStockIssues(err.fields),
      status,
    });
  }
  return new ApiError({
    code: CODE_FOR_STATUS[status] ?? "server_error",
    message: MESSAGE_FOR_STATUS[status] ?? "Serverda xatolik yuz berdi",
    status,
  });
}
