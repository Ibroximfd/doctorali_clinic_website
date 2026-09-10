import type { Metadata } from "next";

import { DoctorsView } from "@/features/doctors/components/doctors-view";

export const metadata: Metadata = {
  title: "Shifokorlar",
  description: "Shifokorlar bo'yicha statistika.",
};

export default function DoctorsPage() {
  return <DoctorsView />;
}
