import type { Metadata } from "next";

import { DoctorDetailView } from "@/features/doctors/components/doctor-detail-view";

export const metadata: Metadata = {
  title: "Shifokor",
  description: "Shifokor bo'yicha statistika.",
};

export default async function DoctorDetailPage({ params }: PageProps<"/doctors/[id]">) {
  const { id } = await params;
  return <DoctorDetailView doctorId={id} />;
}
