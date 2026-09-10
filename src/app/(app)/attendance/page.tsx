import type { Metadata } from "next";

import { AttendanceView } from "@/features/attendance/components/attendance-view";

export const metadata: Metadata = {
  title: "Yo'qlama",
  description: "Xodimlar davomati: kunlik yo'qlama va statistika.",
};

export default function AttendancePage() {
  return <AttendanceView />;
}
