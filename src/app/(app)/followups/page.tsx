import type { Metadata } from "next";

import { FollowupsView } from "@/features/followups/components/followups-view";

export const metadata: Metadata = {
  title: "Eslatmalar",
  description: "Mijozlarni qayta chaqirish.",
};

export default function FollowupsPage() {
  return <FollowupsView />;
}
