import {
  Activity,
  Banknote,
  Bell,
  BriefcaseMedical,
  ChartNoAxesCombined,
  CreditCard,
  Inbox,
  Leaf,
  ReceiptText,
  ShoppingCart,
  Undo2,
  UserCheck,
  Users,
  Wallet,
  Warehouse,
  CalendarCheck,
  type LucideIcon,
} from "lucide-react";

import type { NavIcon } from "@/config/routes";

/**
 * Maps a route's icon name to its lucide component.
 *
 * The Flutter app named Material icons directly on the route enum; the names
 * are kept semantic here so swapping an icon is a one-line change and no route
 * definition imports a component.
 */
const ICONS: Readonly<Record<NavIcon, LucideIcon>> = {
  chart: ChartNoAxesCombined,
  cart: ShoppingCart,
  calendarCheck: CalendarCheck,
  users: Users,
  receipt: ReceiptText,
  inbox: Inbox,
  undo: Undo2,
  activity: Activity,
  creditCard: CreditCard,
  warehouse: Warehouse,
  wallet: Wallet,
  banknote: Banknote,
  userCheck: UserCheck,
  bell: Bell,
  briefcaseMedical: BriefcaseMedical,
  leaf: Leaf,
};

export function navIcon(name: NavIcon): LucideIcon {
  return ICONS[name];
}
