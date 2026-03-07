"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { adminApi } from "@/lib/admin/api";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import type { Quote } from "@/lib/admin/types";

const STATUSES = ["pending", "reviewed", "approved", "rejected", "completed"];

export default function QuoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    adminApi
      .getQuote(id)
      .then((d) => {
        const q = d as Quote;
        setQuote(q);
        setNotes(q.adminNotes || "");
      })
      .catch((e) => setError(e.message));
  }, [id]);

  async function handleStatusChange(status: string) {
    setSaving(true);
    try {
      await adminApi.updateQuoteStatus(id, status);
      setQuote((prev) => (prev ? { ...prev, status } : prev));
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveNotes() {
    setSaving(true);
    try {
      await adminApi.updateQuote(id, { adminNotes: notes });
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this quote? This cannot be undone.")) return;
    try {
      await adminApi.deleteQuote(id);
      router.push("/admin/quotes");
    } catch (e: unknown) {
      setError((e as Error).message);
    }
  }

  async function handleConvert() {
    if (!quote) return;
    setSaving(true);
    try {
      const result = await adminApi.convertQuoteToInvoice(id, {
        amount: quote.pricing?.totalCost || 0,
      });
      const inv = result as { invoice: { id: string } };
      router.push(`/admin/invoices/${inv.invoice.id}`);
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
  if (!quote) return <p className="text-sm text-muted">Loading...</p>;

  return (
    <div>
      <PageHeader
        title={`Quote - ${quote.customer?.name || "Unknown"}`}
        description={`Created ${new Date(quote.createdAt).toLocaleString()}`}
        actions={
          <div className="flex items-center gap-2">
            {quote.status === "approved" && (
              <button
                onClick={handleConvert}
                disabled={saving}
                className="rounded-lg bg-green/20 px-3 py-1.5 text-sm text-green hover:bg-green/30 transition-colors disabled:opacity-50"
              >
                Convert to Invoice
              </button>
            )}
            <button
              onClick={handleDelete}
              className="rounded-lg bg-red-500/10 px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/20 transition-colors"
            >
              Delete
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          <Section title="Customer">
            <Field label="Name" value={quote.customer?.name} />
            <Field label="Email" value={quote.customer?.email} />
            <Field label="Phone" value={quote.customer?.phone} />
            <Field label="Address" value={quote.customer?.address} />
          </Section>

          <Section title="Service Details">
            <Field label="Type" value={quote.packageOption || quote.serviceType} />
            <Field label="Centralization" value={quote.centralization} />
            {quote.runs && (
              <div className="grid grid-cols-3 gap-4">
                <Field label="Cat6 Runs" value={quote.runs.cat6} />
                <Field label="Coax Runs" value={quote.runs.coax} />
                <Field label="Fiber Runs" value={quote.runs.fiber} />
              </div>
            )}
            {quote.services && (
              <div className="grid grid-cols-3 gap-4">
                <Field label="AP Mounts" value={quote.services.apMount} />
                <Field label="Eth Relocation" value={quote.services.ethRelocation} />
                <Field label="Media Panel" value={quote.services.mediaPanel} />
              </div>
            )}
          </Section>

          {quote.equipment && quote.equipment.length > 0 && (
            <Section title="Equipment">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted">
                      <th className="pb-2">Item</th>
                      <th className="pb-2">Category</th>
                      <th className="pb-2">Qty</th>
                      <th className="pb-2">Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {quote.equipment.map((eq, i) => (
                      <tr key={i}>
                        <td className="py-2 text-foreground">{eq.name}</td>
                        <td className="py-2 text-muted">{eq.category}</td>
                        <td className="py-2 text-muted">{eq.quantity}</td>
                        <td className="py-2 text-muted">${eq.price}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          <Section title="Admin Notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-green focus:outline-none focus:ring-1 focus:ring-green"
            />
            <button
              onClick={handleSaveNotes}
              disabled={saving}
              className="mt-2 rounded-lg bg-green/20 px-4 py-1.5 text-sm text-green hover:bg-green/30 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Notes"}
            </button>
          </Section>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Section title="Status">
            <div className="mb-3">
              <StatusBadge status={quote.status} />
            </div>
            <div className="space-y-2">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  disabled={saving || quote.status === s}
                  onClick={() => handleStatusChange(s)}
                  className={`block w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                    quote.status === s
                      ? "border-green/30 bg-green/10 text-green"
                      : "border-border text-muted hover:bg-surface-light hover:text-foreground"
                  } disabled:opacity-50`}
                >
                  <span className="capitalize">{s}</span>
                </button>
              ))}
            </div>
          </Section>

          <Section title="Pricing">
            {quote.pricing?.totalCost != null && (
              <Field label="Total Cost" value={`$${quote.pricing.totalCost.toFixed(2)}`} />
            )}
            {quote.pricing?.depositRequired != null && (
              <Field label="Deposit Required" value={`$${quote.pricing.depositRequired}`} />
            )}
            {quote.pricing?.depositAmount != null && (
              <Field label="Deposit Amount" value={`$${quote.pricing.depositAmount}`} />
            )}
            {quote.discount != null && quote.discount > 0 && (
              <Field label="Discount" value={`${quote.discount}%`} />
            )}
            {quote.finalQuoteAmount != null && (
              <Field label="Final Quote" value={`$${quote.finalQuoteAmount.toFixed(2)}`} />
            )}
          </Section>

          {quote.invoiceId && (
            <Section title="Invoice">
              <a
                href={`/admin/invoices/${quote.invoiceId}`}
                className="text-sm text-green hover:text-green-vivid transition-colors"
              >
                View Invoice &rarr;
              </a>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <h3 className="mb-4 text-sm font-medium text-foreground">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="mb-2">
      <span className="text-xs text-muted">{label}</span>
      <p className="text-sm text-foreground">{value ?? "—"}</p>
    </div>
  );
}
