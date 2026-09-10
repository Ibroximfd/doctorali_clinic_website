import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ClientProfileView } from "@/features/clients/components/client-profile-view";

export const metadata: Metadata = {
  title: "Mijoz kartasi",
  description: "Mijozning tashriflari, buyurtmalari, qarzlari va tarixi.",
};

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const clientId = Number(id);
  if (!Number.isInteger(clientId) || clientId <= 0) notFound();
  return <ClientProfileView clientId={clientId} />;
}
