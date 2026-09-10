import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ClientProfileView } from "@/features/clients/components/client-profile-view";

export const metadata: Metadata = {
  title: "Mijoz kartasi",
  description: "Telefon raqami bo'yicha mijoz kartasi.",
};

/**
 * The flow where only the number is known — reception types a phone and lands
 * on either the card or an empty one offering to open it.
 */
export default async function ClientByPhonePage({
  params,
}: {
  params: Promise<{ phone: string }>;
}) {
  const { phone } = await params;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 9) notFound();
  return <ClientProfileView phone={digits} />;
}
