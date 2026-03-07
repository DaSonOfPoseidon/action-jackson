"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { adminApi } from "@/lib/admin/api";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import type { Schedule } from "@/lib/admin/types";

const STATUSES = ["pending", "confirmed", "in-progress", "completed", "cancelled"];

export default function ScheduleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminApi
      .getSchedule(id)
      .then((d) => setSchedule(d as Schedule))
      .catch((e) => setError(e.message));
  }, [id]);

  async function handleStatusChange(status: string) {
    setSaving(true);
    try {
      await adminApi.updateScheduleStatus(id, status);
      setSchedule((prev) => (prev ? { ...prev, status } : prev));
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this schedule? This cannot be undone.")) return;
    try {
      await adminApi.deleteSchedule(id);
      router.push("/admin/schedule");
    } catch (e: unknown) {
      setError((e as Error).message);
    }
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
        {error}
      </div>
    );
  }
  if (!schedule) return <p className="text-sm text-muted">Loading...</p>;

  return (
    <div>
      <PageHeader
        title={`Schedule - ${schedule.name}`}
        description={`Created ${new Date(schedule.createdAt).toLocaleString()}`}
        actions={
          <button
            onClick={handleDelete}
            className="rounded-lg bg-red-500/10 px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/20 transition-colors"
          >
            Delete
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-border bg-surface p-5">
            <h3 className="mb-4 text-sm font-medium text-foreground">Contact Info</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Name" value={schedule.name} />
              <Field label="Email" value={schedule.email} />
              <Field label="Phone" value={schedule.phone} />
              <Field label="Service Type" value={schedule.serviceType} />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-surface p-5">
            <h3 className="mb-4 text-sm font-medium text-foreground">Appointment</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label="Date"
                value={
                  schedule.scheduledDate
                    ? new Date(schedule.scheduledDate).toLocaleDateString()
                    : schedule.date
                      ? new Date(schedule.date).toLocaleDateString()
                      : undefined
                }
              />
              <Field label="Time" value={schedule.time} />
            </div>
            {schedule.notes && (
              <div className="mt-4">
                <span className="text-xs text-muted">Notes</span>
                <p className="mt-1 text-sm text-foreground whitespace-pre-wrap">{schedule.notes}</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-surface p-5">
            <h3 className="mb-4 text-sm font-medium text-foreground">Status</h3>
            <div className="mb-3">
              <StatusBadge status={schedule.status} />
            </div>
            <div className="space-y-2">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  disabled={saving || schedule.status === s}
                  onClick={() => handleStatusChange(s)}
                  className={`block w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                    schedule.status === s
                      ? "border-green/30 bg-green/10 text-green"
                      : "border-border text-muted hover:bg-surface-light hover:text-foreground"
                  } disabled:opacity-50`}
                >
                  <span className="capitalize">{s}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <span className="text-xs text-muted">{label}</span>
      <p className="text-sm text-foreground">{value ?? "—"}</p>
    </div>
  );
}
