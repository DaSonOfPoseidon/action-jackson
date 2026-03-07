"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { adminApi } from "@/lib/admin/api";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import type { Invoice } from "@/lib/admin/types";

const STATUSES = ["draft", "sent", "paid", "overdue", "cancelled"];

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminApi
      .getInvoice(id)
      .then((d) => setInvoice(d as Invoice))
      .catch((e) => setError(e.message));
  }, [id]);

  async function handleStatusChange(status: string) {
    setSaving(true);
    try {
      await adminApi.updateInvoiceStatus(id, status);
      setInvoice((prev) => (prev ? { ...prev, status } : prev));
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this invoice? This cannot be undone.")) return;
    try {
      await adminApi.deleteInvoice(id);
      router.push("/admin/invoices");
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
  if (!invoice) return <p className="text-sm text-muted">Loading...</p>;

  return (
    <div>
      <PageHeader
        title={`Invoice ${invoice.invoiceNumber}`}
        description={`Created ${new Date(invoice.createdAt).toLocaleString()}`}
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
            <h3 className="mb-4 text-sm font-medium text-foreground">Customer</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Name" value={invoice.customer?.name} />
              <Field label="Email" value={invoice.customer?.email} />
              <Field label="Phone" value={invoice.customer?.phone} />
              <Field label="Address" value={invoice.customer?.address} />
            </div>
          </div>

          {invoice.serviceDescription && (
            <div className="rounded-xl border border-border bg-surface p-5">
              <h3 className="mb-4 text-sm font-medium text-foreground">Service Description</h3>
              <p className="text-sm text-foreground whitespace-pre-wrap">{invoice.serviceDescription}</p>
            </div>
          )}

          {invoice.items && invoice.items.length > 0 && (
            <div className="rounded-xl border border-border bg-surface p-5">
              <h3 className="mb-4 text-sm font-medium text-foreground">Line Items</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted">
                    <th className="pb-2">Description</th>
                    <th className="pb-2 text-right">Qty</th>
                    <th className="pb-2 text-right">Unit Price</th>
                    <th className="pb-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {invoice.items.map((item, i) => (
                    <tr key={i}>
                      <td className="py-2 text-foreground">{item.description}</td>
                      <td className="py-2 text-right text-muted">{item.quantity}</td>
                      <td className="py-2 text-right text-muted">${item.unitPrice.toFixed(2)}</td>
                      <td className="py-2 text-right text-foreground">${item.total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-surface p-5">
            <h3 className="mb-4 text-sm font-medium text-foreground">Status</h3>
            <div className="mb-3">
              <StatusBadge status={invoice.status} />
            </div>
            <div className="space-y-2">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  disabled={saving || invoice.status === s}
                  onClick={() => handleStatusChange(s)}
                  className={`block w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                    invoice.status === s
                      ? "border-green/30 bg-green/10 text-green"
                      : "border-border text-muted hover:bg-surface-light hover:text-foreground"
                  } disabled:opacity-50`}
                >
                  <span className="capitalize">{s}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-surface p-5">
            <h3 className="mb-4 text-sm font-medium text-foreground">Financial</h3>
            {invoice.amount != null && <Field label="Subtotal" value={`$${invoice.amount.toFixed(2)}`} />}
            {invoice.discount != null && invoice.discount > 0 && (
              <Field label="Discount" value={`${invoice.discount}%`} />
            )}
            <Field label="Final Amount" value={`$${invoice.finalAmount.toFixed(2)}`} />
            <Field
              label="Due Date"
              value={invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : undefined}
            />
          </div>

          {invoice.quoteId && (
            <div className="rounded-xl border border-border bg-surface p-5">
              <h3 className="mb-4 text-sm font-medium text-foreground">Linked Quote</h3>
              <a
                href={`/admin/quotes/${invoice.quoteId}`}
                className="text-sm text-green hover:text-green-vivid transition-colors"
              >
                View Quote &rarr;
              </a>
            </div>
          )}
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
