"use client";

import { Activity, Clock, DollarSign, ShoppingCart, UserPlus, Users } from "lucide-react";

import { StatCard } from "@/shared/components/data-display/stat-card";
import { money } from "@/shared/lib/format/money";

import type { DashboardStats } from "../types/statistics";

/**
 * The figures under the tills: what was billed, how many sales and services,
 * and what went out on credit.
 *
 * Deliberately NOT a repeat of the till tiles above — those answer "what is in
 * the drawer", these answer "what did we do today".
 */
export function DashboardKpiStrip({ stats }: { stats: DashboardStats }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Jami tushum"
        value={money.plain(stats.totalCollected || stats.kpis.totalRevenue)}
        icon={DollarSign}
        tone="primary"
        hint={
          stats.grossRevenue > 0
            ? `Hisoblangan: ${money.plain(stats.grossRevenue)}`
            : undefined
        }
      />
      <StatCard
        label="Buyurtmalar"
        value={String(stats.kpis.totalOrders)}
        icon={ShoppingCart}
        tone="info"
        hint={
          stats.ordersByType.delivery > 0
            ? `Klinika ${stats.ordersByType.clinic} · Dastavka ${stats.ordersByType.delivery}`
            : undefined
        }
      />
      <StatCard
        label="Muolajalar"
        value={String(stats.services.treatmentsCount + stats.services.consultationsCount)}
        icon={Activity}
        tone="gold"
        hint={
          stats.services.servicesRevenue > 0
            ? money.plain(stats.services.servicesRevenue)
            : undefined
        }
      />
      <StatCard
        label="Qarzga berildi"
        value={money.plain(stats.debts.debtIssued)}
        icon={Clock}
        tone={stats.debts.debtOverdue > 0 ? "danger" : "warning"}
        hint={
          stats.debts.debtOverdue > 0
            ? `Muddati o'tgan: ${money.plain(stats.debts.debtOverdue)}`
            : `Qaytarildi: ${money.plain(stats.debts.debtCollected)}`
        }
      />
    </div>
  );
}

/**
 * The second, quieter row: who came in and who is new. Only rendered when the
 * backend actually reports these sections — an all-zero row of client counts is
 * noise, not information.
 */
export function DashboardPeopleStrip({ stats }: { stats: DashboardStats }) {
  const hasVisits =
    stats.visits.arrived + stats.visits.scheduled + stats.visits.noShow > 0;
  const hasClients = stats.clients.totalActive + stats.clients.newClients > 0;
  if (!hasVisits && !hasClients) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {hasVisits && (
        <>
          <StatCard
            label="Tashriflar"
            value={String(stats.visits.arrived)}
            icon={Users}
            tone="primary"
            hint={`Rejada ${stats.visits.scheduled} · Kelmadi ${stats.visits.noShow}`}
          />
          <StatCard
            label="Kelmaganlar"
            value={String(stats.visits.noShow)}
            icon={Clock}
            tone={stats.visits.noShow > 0 ? "warning" : "neutral"}
          />
        </>
      )}
      {hasClients && (
        <>
          <StatCard
            label="Yangi mijozlar"
            value={String(stats.clients.newClients)}
            icon={UserPlus}
            tone="info"
          />
          <StatCard
            label="Qaytgan mijozlar"
            value={String(stats.clients.returning)}
            icon={Users}
            tone="neutral"
            hint={`Faol: ${stats.clients.totalActive}`}
          />
        </>
      )}
    </div>
  );
}
