"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { adminApi } from "@/lib/admin/api";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatsCard } from "@/components/admin/StatsCard";
import { StatusBadge } from "@/components/admin/StatusBadge";
import type { DashboardStats } from "@/lib/admin/types";

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardStats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    adminApi
      .getDashboard()
      .then((d) => setData(d as DashboardStats))
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
        {error}
      </div>
    );
  }

  if (!data) {
    return <p className="text-sm text-muted">Loading dashboard...</p>;
  }

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Overview of recent activity (last 30 days)"
      />

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard label="Quotes" value={data.stats.quotes} icon="fa-file-invoice-dollar" />
        <StatsCard label="Schedules" value={data.stats.schedules} icon="fa-calendar-alt" />
        <StatsCard label="Invoices" value={data.stats.invoices} icon="fa-receipt" />
        <StatsCard label="Consultations" value={data.stats.consultations} icon="fa-comments" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Quotes */}
        <RecentList
          title="Recent Quotes"
          href="/admin/quotes"
          items={data.recentActivity.quotes}
          renderItem={(q) => (
            <Link
              key={q._id}
              href={`/admin/quotes/${q._id}`}
              className="flex items-center justify-between rounded-lg px-3 py-2 transition-colors hover:bg-surface-light"
            >
              <div>
                <p className="text-sm text-foreground">{q.customer?.name}</p>
                <p className="text-xs text-muted">
                  {q.packageOption || q.serviceType} &middot;{" "}
                  {new Date(q.createdAt).toLocaleDateString()}
                </p>
              </div>
              <StatusBadge status={q.status} />
            </Link>
          )}
        />

        {/* Recent Consultations */}
        <RecentList
          title="Recent Consultations"
          href="/admin/consultations"
          items={data.recentActivity.consultations}
          renderItem={(c) => (
            <Link
              key={c._id}
              href={`/admin/consultations/${c._id}`}
              className="flex items-center justify-between rounded-lg px-3 py-2 transition-colors hover:bg-surface-light"
            >
              <div>
                <p className="text-sm text-foreground">{c.customer?.name}</p>
                <p className="text-xs text-muted">
                  {c.requestNumber || "—"} &middot;{" "}
                  {new Date(c.createdAt).toLocaleDateString()}
                </p>
              </div>
              <StatusBadge status={c.status} />
            </Link>
          )}
        />

        {/* Recent Schedules */}
        <RecentList
          title="Recent Schedules"
          href="/admin/schedule"
          items={data.recentActivity.schedules}
          renderItem={(s) => (
            <Link
              key={s._id}
              href={`/admin/schedule/${s._id}`}
              className="flex items-center justify-between rounded-lg px-3 py-2 transition-colors hover:bg-surface-light"
            >
              <div>
                <p className="text-sm text-foreground">{s.name}</p>
                <p className="text-xs text-muted">
                  {s.date
                    ? new Date(s.date).toLocaleDateString()
                    : new Date(s.createdAt).toLocaleDateString()}
                </p>
              </div>
              <StatusBadge status={s.status} />
            </Link>
          )}
        />

        {/* Recent Invoices */}
        <RecentList
          title="Recent Invoices"
          href="/admin/invoices"
          items={data.recentActivity.invoices}
          renderItem={(inv) => (
            <Link
              key={inv._id}
              href={`/admin/invoices/${inv._id}`}
              className="flex items-center justify-between rounded-lg px-3 py-2 transition-colors hover:bg-surface-light"
            >
              <div>
                <p className="text-sm text-foreground">
                  {inv.invoiceNumber}
                </p>
                <p className="text-xs text-muted">
                  {inv.customer?.name} &middot; $
                  {inv.finalAmount?.toFixed(2)}
                </p>
              </div>
              <StatusBadge status={inv.status} />
            </Link>
          )}
        />
      </div>
    </div>
  );
}

function RecentList<T>({
  title,
  href,
  items,
  renderItem,
}: {
  title: string;
  href: string;
  items: T[];
  renderItem: (item: T) => React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        <Link
          href={href}
          className="text-xs text-green hover:text-green-vivid transition-colors"
        >
          View all
        </Link>
      </div>
      <div className="divide-y divide-border p-2">
        {items.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-muted">
            No recent items
          </p>
        ) : (
          items.map(renderItem)
        )}
      </div>
    </div>
  );
}
