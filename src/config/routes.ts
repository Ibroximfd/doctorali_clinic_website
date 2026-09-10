/**
 * Typed route definitions — ported from Flutter's `AppRoute`.
 *
 * Paths live here so navigation code and the sidebar reference one source of
 * truth. Declaration order IS the sidebar order, and it follows reception's
 * day: see the numbers → take the walk-in → find the client → sell → treat →
 * chase the debt → check the stock room → then the back-office pages.
 */

export const AppRoutes = {
  dashboard: "/",
  newOrder: "/new-order",
  appointments: "/appointments",
  clients: "/clients",
  orders: "/orders",
  treatments: "/treatments",
  debts: "/debts",
  warehouse: "/warehouse",
  payouts: "/payouts",
  expenses: "/expenses",
  attendance: "/attendance",
  followups: "/followups",
  doctors: "/doctors",
  products: "/products",
  login: "/login",
} as const;

export type AppRoutePath = (typeof AppRoutes)[keyof typeof AppRoutes];

/** Icon names, resolved to `lucide-react` components by the sidebar. */
export type NavIcon =
  | "chart"
  | "cart"
  | "calendarCheck"
  | "users"
  | "receipt"
  | "activity"
  | "creditCard"
  | "warehouse"
  | "wallet"
  | "banknote"
  | "userCheck"
  | "bell"
  | "briefcaseMedical"
  | "leaf";

export interface NavEntry {
  readonly path: AppRoutePath;
  readonly label: string;
  /** The line under the page title in the top bar. */
  readonly subtitle: string;
  readonly icon: NavIcon;
}

export interface NavSection {
  readonly title: string;
  readonly entries: readonly NavEntry[];
}

/**
 * The sidebar grouped by what reception is doing, not by feature age: serving
 * the client in front of them, chasing the money, then the back-office pages
 * they open once a week.
 */
export const NAV_SECTIONS: readonly NavSection[] = [
  {
    title: "Asosiy",
    entries: [
      {
        path: AppRoutes.dashboard,
        label: "Statistika",
        subtitle: "Klinika savdo ko'rsatkichlari",
        icon: "chart",
      },
      {
        path: AppRoutes.newOrder,
        label: "Yangi buyurtma",
        subtitle: "Mijoz uchun yangi buyurtma yarating",
        icon: "cart",
      },
      {
        path: AppRoutes.appointments,
        label: "Tashriflar",
        subtitle: "Rejalashtirilgan tashriflar",
        icon: "calendarCheck",
      },
      {
        path: AppRoutes.clients,
        label: "Mijozlar",
        subtitle: "Mijozlar bazasi va tarixi",
        icon: "users",
      },
    ],
  },
  {
    title: "Moliya",
    entries: [
      {
        path: AppRoutes.orders,
        label: "Buyurtmalar",
        subtitle: "Barcha buyurtmalar tarixi",
        icon: "receipt",
      },
      {
        path: AppRoutes.treatments,
        label: "Muolajalar",
        subtitle: "Muolaja va konsultatsiyalar",
        icon: "activity",
      },
      {
        path: AppRoutes.debts,
        label: "Qarzlar",
        subtitle: "Qarzlar va qaytarish muddatlari",
        icon: "creditCard",
      },
      {
        path: AppRoutes.warehouse,
        label: "Sklad",
        subtitle: "Klinika ombori: qoldiq, kirim, chiqim",
        icon: "warehouse",
      },
    ],
  },
  {
    title: "Boshqaruv",
    entries: [
      {
        path: AppRoutes.payouts,
        label: "To'lovlar",
        subtitle: "Shifokorlarga haftalik komissiya to'lovlari",
        icon: "wallet",
      },
      {
        path: AppRoutes.expenses,
        label: "Xarajatlar",
        subtitle: "Kunlik xarajatlarni qayd etish va nazorat qilish",
        icon: "banknote",
      },
      {
        path: AppRoutes.attendance,
        label: "Yo'qlama",
        subtitle: "Xodimlar davomati: kunlik yo'qlama va statistika",
        icon: "userCheck",
      },
      {
        path: AppRoutes.followups,
        label: "Eslatmalar",
        subtitle: "Mijozlarni qayta chaqirish",
        icon: "bell",
      },
      {
        path: AppRoutes.doctors,
        label: "Shifokorlar",
        subtitle: "Shifokorlar bo'yicha statistika",
        icon: "briefcaseMedical",
      },
      {
        path: AppRoutes.products,
        label: "Mahsulotlar",
        subtitle: "Mahsulotlar katalogi va savdosi",
        icon: "leaf",
      },
    ],
  },
] as const;

export const NAV_ENTRIES: readonly NavEntry[] = NAV_SECTIONS.flatMap(
  (section) => section.entries,
);

// --- Sub-routes --------------------------------------------------------------

/** `/clients/12` — bookmarkable 360° client card. */
export const clientDetailPath = (id: number) => `/clients/${id}`;
/** `/clients/phone/998901234567` — the flow where only the number is known. */
export const clientByPhonePath = (phone: string) =>
  `/clients/phone/${phone.replace(/\D/g, "")}`;
/** `/doctors/7` — per-doctor statistics. */
export const doctorDetailPath = (id: string) => `/doctors/${id}`;

/**
 * Removed screen: reception no longer opens client accounts (clients sign in
 * with phone + OTP themselves). Kept so old bookmarks land on the CRM list
 * instead of a 404.
 */
export const LEGACY_CLIENT_ACCOUNTS = "/client-accounts";

/**
 * Maps any location to the top-level nav entry that should look selected.
 * `/clients/12` highlights "Mijozlar"; `/doctors/7` highlights "Shifokorlar".
 *
 * Order matters: the dashboard is `/`, which prefixes everything, so it is only
 * matched exactly and is the fallback.
 */
export function activeNavPath(pathname: string): AppRoutePath {
  for (const entry of NAV_ENTRIES) {
    if (entry.path === AppRoutes.dashboard) continue;
    if (pathname === entry.path || pathname.startsWith(`${entry.path}/`)) {
      return entry.path;
    }
  }
  return AppRoutes.dashboard;
}

export function navEntryFor(pathname: string): NavEntry {
  const path = activeNavPath(pathname);
  return NAV_ENTRIES.find((e) => e.path === path) ?? NAV_ENTRIES[0];
}
