"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { adminApi } from "@/lib/admin/api";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable, Column } from "@/components/admin/DataTable";
import { StatusBadge } from "@/components/admin/StatusBadge";
import type { Schedule } from "@/lib/admin/types";

function ScheduleContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalCount: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    adminApi
      .getSchedules(searchParams)
      .then((data) => {
        const d = data as { schedules: Schedule[]; pagination: typeof pagination };
        setSchedules(d.schedules);
        setPagination(d.pagination);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [searchParams]);

  const columns: Column<Schedule>[] = [
    { key: "name", label: "Name" },
    { key: "email", label: "Email" },
    {
      key: "date",
      label: "Date",
      render: (s) =>
        s.scheduledDate
          ? new Date(s.scheduledDate).toLocaleDateString()
          : s.date
            ? new Date(s.date).toLocaleDateString()
            : "—",
    },
    { key: "time", label: "Time", render: (s) => s.time || "—" },
    {
      key: "status",
      label: "Status",
      render: (s) => <StatusBadge status={s.status} />,
    },
    {
      key: "createdAt",
      label: "Created",
      render: (s) => new Date(s.createdAt).toLocaleDateString(),
    },
  ];

  return (
    <div>
      <PageHeader title="Schedule" description="Manage appointments" />
      <DataTable
        columns={columns}
        data={schedules}
        onRowClick={(s) => router.push(`/admin/schedule/${s._id}`)}
        pagination={pagination}
        searchPlaceholder="Search by name, email, or phone..."
        filters={[
          {
            key: "status",
            label: "All Statuses",
            options: [
              { value: "pending", label: "Pending" },
              { value: "confirmed", label: "Confirmed" },
              { value: "in-progress", label: "In Progress" },
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

export default function SchedulePage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading...</p>}>
      <ScheduleContent />
    </Suspense>
  );
}
