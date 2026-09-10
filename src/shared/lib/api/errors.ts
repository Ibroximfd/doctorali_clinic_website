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
 *
 * A refusal raised deeper in the stack does NOT always reach that envelope: DRF
 * answers in its own shapes — `{"detail": "…"}`, a bare `{"payment_type":
 * ["…"]}` map, a plain list. Those carry the only sentence that says what went
 * wrong, so {@link apiErrorFromBody} mines every one of them. Falling back to
 * "Serverda xatolik yuz berdi" while the body explains itself sends the desk to
 * the phone for an answer that was already on the wire.
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

/** Last resort when the body says nothing readable at all. */
const INVALID_INPUT = "Kiritilgan ma'lumot noto'g'ri";
const SERVER_ERROR = "Serverda xatolik yuz berdi";

const MESSAGE_FOR_STATUS: Readonly<Record<number, string>> = {
  400: INVALID_INPUT,
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
 * One structured `fields` entry as a sentence: the server's own `message` when
 * it wrote one, else the stock numbers spelled out. Null when the entry is a
 * nested field map rather than an issue — a raw `{product_id: …}` dump must
 * never reach the screen.
 */
function issueSentence(entry: Record<string, unknown>): string | null {
  const message = entry.message;
  if (typeof message === "string" && message.trim() !== "") return message;

  const available = typeof entry.available === "number" ? entry.available : null;
  if (available === null) return null;
  const requested = typeof entry.requested === "number" ? entry.requested : null;
  return (
    `Omborda yetarli emas: qoldiq ${available} dona` +
    (requested === null ? "" : `, kerak: ${requested} dona`)
  );
}

/**
 * Every readable message inside a field's value, flattened.
 *
 * DRF nests as deep as the serializer does — `{"debt": {"amount": ["…"]}}` is
 * as ordinary as `{"payment_type": ["…"]}` — and a `String(value)` on the way
 * out is exactly how "[object Object]" ends up in front of the desk.
 */
function messagesIn(value: unknown): string[] {
  if (typeof value === "string") return value.trim() === "" ? [] : [value];
  if (typeof value === "number" || typeof value === "boolean") return [String(value)];
  if (Array.isArray(value)) return value.flatMap(messagesIn);
  if (isRecord(value)) {
    const own = issueSentence(value);
    return own === null ? Object.values(value).flatMap(messagesIn) : [own];
  }
  return [];
}

function parseFieldErrors(raw: unknown): FieldErrors {
  if (!isRecord(raw)) return {};
  const out: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value === null || value === undefined) continue;
    const messages = messagesIn(value);
    // A refused field always says something: a field marked red with no reason
    // is worse than a generic sentence.
    out[key] = messages.length > 0 ? messages : [INVALID_INPUT];
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

/** Keys that carry the refusal's own sentence rather than one field's. */
const HEADLINE_KEYS = ["message", "detail", "non_field_errors", "error"] as const;

/** A raw text body longer than this is a page, not a sentence. */
const MAX_RAW_MESSAGE = 300;

/**
 * The sentence to put in front of the desk, dug out of whichever shape arrived.
 * Null when the body holds nothing readable — an empty 502, or a proxy's HTML
 * error page, which is a document rather than a message.
 */
function headlineIn(body: unknown): string | null {
  if (typeof body === "string") {
    const text = body.trim();
    if (text === "" || text.startsWith("<")) return null;
    return text.slice(0, MAX_RAW_MESSAGE);
  }
  if (Array.isArray(body)) return messagesIn(body)[0] ?? null;
  if (!isRecord(body)) return null;

  for (const key of HEADLINE_KEYS) {
    const found = messagesIn(body[key])[0];
    if (found !== undefined) return found;
  }
  return null;
}

/**
 * The per-field half of the body: `fields` when the envelope wrapped them,
 * otherwise the body itself minus the keys that speak for the whole refusal —
 * a bare `{"payment_type": ["…"]}` IS the field map.
 */
function fieldsIn(body: unknown): unknown {
  if (!isRecord(body)) return null;
  if (isRecord(body.fields)) return body.fields;

  const fields: Record<string, unknown> = { ...body };
  for (const key of HEADLINE_KEYS) delete fields[key];
  delete fields.code;
  delete fields.status;
  return fields;
}

/** The first field message — what failed, when the body named no sentence. */
function firstFieldMessage(fieldErrors: FieldErrors): string | null {
  for (const messages of Object.values(fieldErrors)) {
    if (messages.length > 0) return messages[0];
  }
  return null;
}

/**
 * Builds an {@link ApiError} from a response body the server sent — the
 * documented `{error: {…}}` envelope, or any of the DRF shapes a refusal
 * raised below the view arrives in.
 */
export function apiErrorFromBody(status: number, body: unknown): ApiError {
  // Unwrap the envelope; everything below then reads one flat object, whether
  // it came from `error` or was the body all along.
  const envelope = isRecord(body) && isRecord(body.error) ? body.error : body;
  const fields = fieldsIn(envelope);
  const fieldErrors = parseFieldErrors(fields);

  return new ApiError({
    code:
      isRecord(envelope) && typeof envelope.code === "string"
        ? envelope.code
        : (CODE_FOR_STATUS[status] ?? "server_error"),
    // The server's own words first, then the field that failed. The status
    // sentence is only for a body that explained nothing.
    message:
      headlineIn(envelope) ??
      firstFieldMessage(fieldErrors) ??
      MESSAGE_FOR_STATUS[status] ??
      SERVER_ERROR,
    fieldErrors,
    stockIssues: parseStockIssues(fields),
    status,
  });
}
