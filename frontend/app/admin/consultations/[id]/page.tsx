"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { adminApi } from "@/lib/admin/api";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import type { ConsultationRequest } from "@/lib/admin/types";

const STATUSES = ["new", "contacted", "scheduled", "quoted", "completed", "cancelled"];

export default function ConsultationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [consultation, setConsultation] = useState<ConsultationRequest | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState("");
  const [quotedAmount, setQuotedAmount] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");

  useEffect(() => {
    adminApi
      .getConsultation(id)
      .then((d) => {
        const c = d as ConsultationRequest;
        setConsultation(c);
        setNotes(c.adminNotes || "");
        setQuotedAmount(c.quotedAmount?.toString() || "");
        setScheduledDate(c.scheduledConsultation || "");
      })
      .catch((e) => setError(e.message));
  }, [id]);

  async function handleStatusChange(status: string) {
    setSaving(true);
    try {
      await adminApi.updateConsultation(id, { status });
      setConsultation((prev) => (prev ? { ...prev, status } : prev));
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await adminApi.updateConsultation(id, {
        adminNotes: notes,
        quotedAmount: quotedAmount ? parseFloat(quotedAmount) : undefined,
        scheduledConsultation: scheduledDate || undefined,
      });
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
        {error}
      </div>
    );
  }
  if (!consultation) return <p className="text-sm text-muted">Loading...</p>;

  return (
    <div>
      <PageHeader
        title={`Consultation - ${consultation.customer?.name || "Unknown"}`}
        description={`${consultation.requestNumber || ""} - Created ${new Date(consultation.createdAt).toLocaleString()}`}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-border bg-surface p-5">
            <h3 className="mb-4 text-sm font-medium text-foreground">Customer</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Name" value={consultation.customer?.name} />
              <Field label="Email" value={consultation.customer?.email} />
              <Field label="Phone" value={consultation.customer?.phone} />
              <Field label="Address" value={consultation.customer?.address} />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-surface p-5">
            <h3 className="mb-4 text-sm font-medium text-foreground">Interests</h3>
            <Field label="Package" value={consultation.interestedPackage} />
            {consultation.interestedServices && consultation.interestedServices.length > 0 && (
              <div className="mb-2">
                <span className="text-xs text-muted">Services</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {consultation.interestedServices.map((s) => (
                    <span
                      key={s}
                      className="rounded-full bg-surface-light px-2 py-0.5 text-xs text-foreground"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {consultation.currentIssues && consultation.currentIssues.length > 0 && (
              <div className="mb-2">
                <span className="text-xs text-muted">Current Issues</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {consultation.currentIssues.map((issue) => (
                    <span
                      key={issue}
                      className="rounded-full bg-orange/10 px-2 py-0.5 text-xs text-orange"
                    >
                      {issue}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {consultation.homeDetails && (
            <div className="rounded-xl border border-border bg-surface p-5">
              <h3 className="mb-4 text-sm font-medium text-foreground">Home Details</h3>
              <div className="grid grid-cols-3 gap-4">
                <Field label="Square Footage" value={consultation.homeDetails.squareFootage} />
                <Field label="Floors" value={consultation.homeDetails.floors} />
                <Field label="Year Built" value={consultation.homeDetails.yearBuilt} />
              </div>
            </div>
          )}

          {consultation.additionalNotes && (
            <div className="rounded-xl border border-border bg-surface p-5">
              <h3 className="mb-4 text-sm font-medium text-foreground">Customer Notes</h3>
              <p className="text-sm text-foreground whitespace-pre-wrap">
                {consultation.additionalNotes}
              </p>
            </div>
          )}

          <div className="rounded-xl border border-border bg-surface p-5">
            <h3 className="mb-4 text-sm font-medium text-foreground">Admin</h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs text-muted">Admin Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-green focus:outline-none focus:ring-1 focus:ring-green"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs text-muted">Quoted Amount</label>
                  <input
                    type="number"
                    value={quotedAmount}
                    onChange={(e) => setQuotedAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-green focus:outline-none focus:ring-1 focus:ring-green"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs text-muted">Scheduled Date</label>
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-green focus:outline-none focus:ring-1 focus:ring-green"
                  />
                </div>
              </div>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-green/20 px-4 py-1.5 text-sm text-green hover:bg-green/30 transition-colors disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-surface p-5">
            <h3 className="mb-4 text-sm font-medium text-foreground">Status</h3>
            <div className="mb-3">
              <StatusBadge status={consultation.status} />
            </div>
            <div className="space-y-2">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  disabled={saving || consultation.status === s}
                  onClick={() => handleStatusChange(s)}
                  className={`block w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                    consultation.status === s
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
    <div className="mb-2">
      <span className="text-xs text-muted">{label}</span>
      <p className="text-sm text-foreground">{value ?? "—"}</p>
    </div>
  );
}
