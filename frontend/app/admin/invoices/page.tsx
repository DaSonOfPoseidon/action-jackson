"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { adminApi } from "@/lib/admin/api";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable, Column } from "@/components/admin/DataTable";
import { StatusBadge } from "@/components/admin/StatusBadge";
import type { Invoice } from "@/lib/admin/types";

function InvoicesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalCount: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    adminApi
      .getInvoices(searchParams)
      .then((data) => {
        const d = data as { invoices: Invoice[]; pagination: typeof pagination };
        setInvoices(d.invoices);
        setPagination(d.pagination);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [searchParams]);

  const columns: Column<Invoice>[] = [
    { key: "invoiceNumber", label: "Invoice #" },
    {
      key: "customer",
      label: "Customer",
      render: (inv) => inv.customer?.name || "—",
    },
    {
      key: "finalAmount",
      label: "Amount",
      render: (inv) =>
        inv.finalAmount != null ? `$${inv.finalAmount.toFixed(2)}` : "—",
    },
    {
      key: "status",
      label: "Status",
      render: (inv) => <StatusBadge status={inv.status} />,
    },
    {
      key: "dueDate",
      label: "Due Date",
      render: (inv) =>
        inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "—",
    },
    {
      key: "createdAt",
      label: "Created",
      render: (inv) => new Date(inv.createdAt).toLocaleDateString(),
    },
  ];

  return (
    <div>
      <PageHeader title="Invoices" description="Manage invoices" />
      <DataTable
        columns={columns}
        data={invoices}
        onRowClick={(inv) => router.push(`/admin/invoices/${inv._id}`)}
        pagination={pagination}
        searchPlaceholder="Search by invoice #, name, or email..."
        filters={[
          {
            key: "status",
            label: "All Statuses",
            options: [
              { value: "draft", label: "Draft" },
              { value: "sent", label: "Sent" },
              { value: "paid", label: "Paid" },
              { value: "overdue", label: "Overdue" },
              { value: "cancelled", label: "Cancelled" },
            ],
          },
        ]}
        isLoading={loading}
      />
    </div>
  );
}

export default function InvoicesPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading...</p>}>
      <InvoicesContent />
    </Suspense>
  );
}
