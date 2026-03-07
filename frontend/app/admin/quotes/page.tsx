"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { adminApi } from "@/lib/admin/api";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable, Column } from "@/components/admin/DataTable";
import { StatusBadge } from "@/components/admin/StatusBadge";
import type { Quote } from "@/lib/admin/types";

function QuotesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalCount: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    adminApi
      .getQuotes(searchParams)
      .then((data) => {
        const d = data as { quotes: Quote[]; pagination: typeof pagination };
        setQuotes(d.quotes);
        setPagination(d.pagination);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [searchParams]);

  const columns: Column<Quote>[] = [
    {
      key: "customer",
      label: "Customer",
      render: (q) => q.customer?.name || "—",
    },
    {
      key: "serviceType",
      label: "Type",
      render: (q) => q.packageOption || q.serviceType || "—",
    },
    {
      key: "pricing",
      label: "Amount",
      render: (q) =>
        q.pricing?.totalCost != null
          ? `$${q.pricing.totalCost.toFixed(2)}`
          : q.pricing?.depositAmount != null
            ? `$${q.pricing.depositAmount} dep.`
            : "—",
    },
    {
      key: "status",
      label: "Status",
      render: (q) => <StatusBadge status={q.status} />,
    },
    {
      key: "createdAt",
      label: "Date",
      render: (q) => new Date(q.createdAt).toLocaleDateString(),
    },
  ];

  return (
    <div>
      <PageHeader title="Quotes" description="Manage quote requests" />
      <DataTable
        columns={columns}
        data={quotes}
        onRowClick={(q) => router.push(`/admin/quotes/${q._id}`)}
        pagination={pagination}
        searchPlaceholder="Search by name or email..."
        filters={[
          {
            key: "status",
            label: "All Statuses",
            options: [
              { value: "pending", label: "Pending" },
              { value: "reviewed", label: "Reviewed" },
              { value: "approved", label: "Approved" },
              { value: "rejected", label: "Rejected" },
              { value: "completed", label: "Completed" },
            ],
          },
        ]}
        isLoading={loading}
      />
    </div>
  );
}

export default function QuotesPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading...</p>}>
      <QuotesContent />
    </Suspense>
  );
}
