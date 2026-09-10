"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

import { PageContainer } from "@/shared/components/data-display/page-container";
import { Tabs, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { Skeleton } from "@/shared/components/ui/skeleton";

import { AttendanceSheetView } from "./attendance-sheet-view";

import { EmployeesView } from "./employees-view";

/** recharts is heavy and this tab is opened rarely — it loads on demand. */
const AttendanceStatsView = dynamic(
  () => import("./attendance-stats-view").then((m) => m.AttendanceStatsView),
  { ssr: false, loading: () => <Skeleton className="h-[320px] rounded-lg" /> },
);

type Tab = "sheet" | "employees" | "stats";

/** "Yo'qlama" — the daily roll-call, the roster behind it, and the period stats. */
export function AttendanceView() {
  const [tab, setTab] = useState<Tab>("sheet");

  return (
    <PageContainer className="flex flex-col gap-4">
      <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
        <TabsList>
          <TabsTrigger value="sheet">Kunlik yo&rsquo;qlama</TabsTrigger>
          <TabsTrigger value="employees">Xodimlar</TabsTrigger>
          <TabsTrigger value="stats">Statistika</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "sheet" && <AttendanceSheetView />}
      {tab === "employees" && <EmployeesView />}
      {tab === "stats" && <AttendanceStatsView />}
    </PageContainer>
  );
}
