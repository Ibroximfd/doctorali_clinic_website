import type { Metadata } from "next";

import { ExpensesView } from "@/features/expenses/components/expenses-view";

export const metadata: Metadata = {
  title: "Xarajatlar",
  description: "Kunlik xarajatlarni qayd etish va nazorat qilish.",
};

export default function ExpensesPage() {
  return <ExpensesView />;
}
