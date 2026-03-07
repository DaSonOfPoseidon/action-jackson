"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { adminApi } from "@/lib/admin/api";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable, Column } from "@/components/admin/DataTable";
import { StatusBadge } from "@/components/admin/StatusBadge";
import type { ConsultationRequest } from "@/lib/admin/types";

function ConsultationsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [consultations, setConsultations] = useState<ConsultationRequest[]>([]);
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalCount: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    adminApi
      .getConsultations(searchParams)
      .then((data) => {
        const d = data as { consultations: ConsultationRequest[]; pagination: typeof pagination };
        setConsultations(d.consultations);
        setPagination(d.pagination);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [searchParams]);

  const columns: Column<ConsultationRequest>[] = [
    {
      key: "requestNumber",
      label: "Request #",
      render: (c) => c.requestNumber || "—",
    },
    {
      key: "customer",
      label: "Customer",
      render: (c) => c.customer?.name || "—",
    },
    {
      key: "interestedPackage",
      label: "Package",
      render: (c) => c.interestedPackage || "—",
    },
    {
      key: "status",
      label: "Status",
      render: (c) => <StatusBadge status={c.status} />,
    },
    {
      key: "createdAt",
      label: "Date",
      render: (c) => new Date(c.createdAt).toLocaleDateString(),
    },
  ];

  return (
    <div>
      <PageHeader title="Consultations" description="Manage consultation requests" />
      <DataTable
        columns={columns}
        data={consultations}
        onRowClick={(c) => router.push(`/admin/consultations/${c._id}`)}
        pagination={pagination}
        searchPlaceholder="Search by name, email, or request #..."
        filters={[
          {
            key: "status",
            label: "All Statuses",
            options: [
              { value: "new", label: "New" },
              { value: "contacted", label: "Contacted" },
              { value: "scheduled", label: "Scheduled" },
              { value: "quoted", label: "Quoted" },
              { value: "completed", label: "Completed" },
              { value: "cancelled", label: "Cancelled" },
            ],
          },
        ]}
        isLoading={loading}
      />
    </div>
  );
}

export default function ConsultationsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading...</p>}>
      <ConsultationsContent />
    </Suspense>
  );
}
