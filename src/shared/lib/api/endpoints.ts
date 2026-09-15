/**
 * Single source of truth for every reception API path.
 *
 * No endpoint string is written inline anywhere else — ported verbatim from the
 * Flutter app's `ApiConstants`. Parameterised paths are builder functions.
 *
 * Paths carry NO leading slash: they are appended to the configured base URL
 * (`https://…/api/reception/`) by the HTTP client.
 */
export const endpoints = {
  // --- Auth ------------------------------------------------------------------
  login: "auth/login/",
  refresh: "auth/refresh/",
  me: "auth/me/",
  /**
   * Checks the 4-digit PIN that authorises changing a record that isn't
   * today's (backdated order, edit, delete).
   */
  verifyPin: "auth/verify-pin/",

  // --- Catalog ---------------------------------------------------------------
  /** Doubles as the CRM client list; the legacy `?phone=` lookup answers here. */
  clients: "clients/",
  doctors: "doctors/",
  products: "products/",

  // --- Clients (CRM) ---------------------------------------------------------
  client: (id: number) => `clients/${id}/`,
  clientsSearch: "clients/search/",
  clientProfile: "clients/profile/",
  clientsDuplicates: "clients/duplicates/",
  clientsMerge: "clients/merge/",
  clientsTags: "clients/tags/",
  clientsExport: "clients/export/",
  clientsImport: "clients/import/",
  clientTimeline: (id: number) => `clients/${id}/timeline/`,
  clientOrders: (id: number) => `clients/${id}/orders/`,
  clientVisits: (id: number) => `clients/${id}/visits/`,
  clientTreatments: (id: number) => `clients/${id}/treatments/`,
  clientDebts: (id: number) => `clients/${id}/debts/`,
  clientNotes: (id: number) => `clients/${id}/notes/`,
  clientTags: (id: number) => `clients/${id}/tags/`,
  clientBlock: (id: number) => `clients/${id}/block/`,
  clientUnblock: (id: number) => `clients/${id}/unblock/`,
  clientAnonymize: (id: number) => `clients/${id}/anonymize/`,
  clientRecompute: (id: number) => `clients/${id}/recompute/`,

  // --- Debts -----------------------------------------------------------------
  debts: "debts/",
  debtsSummary: "debts/summary/",
  debtsExport: "debts/export/",
  debt: (id: string) => `debts/${id}/`,
  debtPay: (id: string) => `debts/${id}/pay/`,
  debtCancel: (id: string) => `debts/${id}/cancel/`,

  // --- Treatments ------------------------------------------------------------
  treatments: "treatments/",
  treatmentsSummary: "treatments/summary/",
  /** Prices a service before it is saved — the server's own commission. */
  treatmentsPreview: "treatments/preview/",
  treatmentTypes: "treatments/types/",
  treatment: (id: string) => `treatments/${id}/`,
  treatmentCancel: (id: string) => `treatments/${id}/cancel/`,

  // --- Alerts / notifications ------------------------------------------------
  alerts: "alerts/",
  alertsDaily: "alerts/daily/",
  /** Locks a day with the cash actually counted in the drawer. */
  alertsDailyClose: "alerts/daily/close/",
  alertsDailyExport: "alerts/daily/export/",
  alertsDataQuality: "alerts/data-quality/",
  notificationLogs: "notifications/logs/",

  // --- Warehouse -------------------------------------------------------------
  warehouseStock: "warehouse/stock/",
  warehouseStockItem: (productId: string) => `warehouse/stock/${productId}/`,
  warehouseMovements: "warehouse/movements/",
  warehouseReceipts: "warehouse/receipts/",
  warehouseReceipt: (id: string) => `warehouse/receipts/${id}/`,
  warehouseReceiptConfirm: (id: string) => `warehouse/receipts/${id}/confirm/`,
  warehouseReceiptCancel: (id: string) => `warehouse/receipts/${id}/cancel/`,
  warehouseWriteOffs: "warehouse/write-offs/",
  warehouseWriteOff: (id: string) => `warehouse/write-offs/${id}/`,
  warehouseWriteOffConfirm: (id: string) => `warehouse/write-offs/${id}/confirm/`,
  warehouseWriteOffCancel: (id: string) => `warehouse/write-offs/${id}/cancel/`,
  warehouseCounts: "warehouse/counts/",
  warehouseCount: (id: string) => `warehouse/counts/${id}/`,
  warehouseCountConfirm: (id: string) => `warehouse/counts/${id}/confirm/`,
  warehouseSummary: "warehouse/summary/",
  warehouseExport: "warehouse/export/",

  // --- Orders ----------------------------------------------------------------
  orders: "orders/",
  order: (id: string) => `orders/${id}/`,
  /** Prices a basket without booking anything — the authority on the money. */
  ordersPreview: "orders/preview/",
  orderCancel: (id: string) => `orders/${id}/cancel/`,
  /**
   * Returns goods from a sale: stock back on the shelf, money out of the till,
   * commission and debt reduced. ALWAYS needs `X-Confirm-Pin`, whatever the
   * order's date — money leaves the drawer, so the day is irrelevant.
   */
  orderReturn: (id: string) => `orders/${id}/return/`,
  /** The same payload the create response carries, so a reprint keeps its number. */
  orderReceipt: (id: string) => `orders/${id}/receipt/`,

  // --- Returns ---------------------------------------------------------------
  returns: "returns/",
  /** PATCH only, and only `reason` — the money and the lines are immutable. */
  orderReturnItem: (id: string) => `returns/${id}/`,

  // --- Follow-ups ------------------------------------------------------------
  followups: "followups/",
  followupContact: (clientId: number) => `followups/${clientId}/contact/`,
  followupHistory: (clientId: number) => `followups/${clientId}/history/`,

  // --- Doctor weekly payouts -------------------------------------------------
  payoutsOutstanding: "payouts/outstanding/",
  payoutsWeek: "payouts/week/",
  payoutsPay: "payouts/pay/",
  payouts: "payouts/",
  payout: (id: string) => `payouts/${id}/`,
  payoutCancel: (id: string) => `payouts/${id}/cancel/`,

  // --- Daily expenses --------------------------------------------------------
  expenses: "expenses/",
  expense: (id: string) => `expenses/${id}/`,
  expensesSummary: "expenses/summary/",

  // --- Employees and attendance ----------------------------------------------
  employees: "employees/",
  employee: (id: string) => `employees/${id}/`,
  /** GET reads a day; POST saves one or many marks at once (all-or-nothing). */
  attendance: "attendance/",
  attendanceStatistics: "attendance/statistics/",

  // --- Statistics ------------------------------------------------------------
  statsDashboard: "statistics/dashboard/",
  statsProducts: "statistics/products/",
  statsDoctors: "statistics/doctors/",
  statsDoctor: (id: string) => `statistics/doctors/${id}/`,
  /** Everything one till took in over a period. */
  statsPaymentType: "statistics/payment-type/",
  statsClients: "statistics/clients/",
  statsServices: "statistics/services/",
  statsCashflow: "statistics/cashflow/",
  /** Streams the current statistics as a formatted `.xlsx` (binary, not JSON). */
  statsExport: "statistics/export/",

  // --- Appointments ----------------------------------------------------------
  appointments: "appointments/",
  appointmentsToday: "appointments/today/",
  appointment: (id: string) => `appointments/${id}/`,
  appointmentArrived: (id: string) => `appointments/${id}/arrived/`,
  appointmentCancel: (id: string) => `appointments/${id}/cancel/`,
} as const;

/** Paths that must NOT carry an Authorization header. */
export const AUTH_FREE_PATHS: readonly string[] = [endpoints.login, endpoints.refresh];

/**
 * Header carrying the verified PIN on the write itself, so the server re-checks
 * it instead of trusting the app's dialog.
 */
export const CONFIRM_PIN_HEADER = "X-Confirm-Pin";

/** One key per submission, reused across retries (backend §11.2). */
export const IDEMPOTENCY_HEADER = "Idempotency-Key";
