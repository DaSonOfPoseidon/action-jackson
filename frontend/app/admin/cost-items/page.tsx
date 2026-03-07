"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { adminApi } from "@/lib/admin/api";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable, Column } from "@/components/admin/DataTable";
import { StatusBadge } from "@/components/admin/StatusBadge";
import type { CostItem } from "@/lib/admin/types";

function CostItemsContent() {
  const searchParams = useSearchParams();
  const [costItems, setCostItems] = useState<CostItem[]>([]);
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalCount: 0 });
  const [laborRate, setLaborRate] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editItem, setEditItem] = useState<CostItem | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchData = useCallback(() => {
    setLoading(true);
    adminApi
      .getCostItems(searchParams)
      .then((data) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const d = data as any;
        setCostItems(d.costItems);
        setPagination(d.pagination);
        setLaborRate(d.laborRate || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [searchParams]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleToggle(id: string) {
    try {
      await adminApi.toggleCostItem(id);
      fetchData();
    } catch (e: unknown) {
      setError((e as Error).message);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this cost item?")) return;
    try {
      await adminApi.deleteCostItem(id);
      fetchData();
    } catch (e: unknown) {
      setError((e as Error).message);
    }
  }

  async function handleSeed() {
    if (!confirm("Seed default cost items? Existing items won't be overwritten.")) return;
    setSaving(true);
    try {
      await adminApi.seedCostItems();
      fetchData();
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveLaborRate(newRate: number) {
    try {
      await adminApi.updateLaborRate(newRate);
      setLaborRate(newRate);
    } catch (e: unknown) {
      setError((e as Error).message);
    }
  }

  const columns: Column<CostItem>[] = [
    { key: "code", label: "Code" },
    { key: "name", label: "Name" },
    { key: "category", label: "Category" },
    {
      key: "price",
      label: "Price",
      render: (item) => `$${item.price.toFixed(2)}`,
    },
    {
      key: "isActive",
      label: "Status",
      render: (item) => (
        <StatusBadge status={item.isActive ? "active" : "inactive"} />
      ),
    },
    {
      key: "actions",
      label: "",
      render: (item) => (
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setEditItem(item);
            }}
            className="text-xs text-muted hover:text-foreground"
          >
            Edit
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleToggle(item._id);
            }}
            className="text-xs text-muted hover:text-foreground"
          >
            {item.isActive ? "Disable" : "Enable"}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(item._id);
            }}
            className="text-xs text-red-400 hover:text-red-300"
          >
            Delete
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Cost Items"
        description="Manage equipment and service pricing"
        actions={
          <div className="flex items-center gap-2">
            <LaborRateControl rate={laborRate} onSave={handleSaveLaborRate} />
            <button
              onClick={handleSeed}
              disabled={saving}
              className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:bg-surface-light transition-colors disabled:opacity-50"
            >
              Seed Defaults
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="rounded-lg bg-green/20 px-3 py-1.5 text-sm text-green hover:bg-green/30 transition-colors"
            >
              + New Item
            </button>
          </div>
        }
      />

      {error && (
        <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
          {error}
          <button onClick={() => setError("")} className="ml-2 underline">dismiss</button>
        </div>
      )}

      <DataTable
        columns={columns}
        data={costItems}
        pagination={pagination}
        searchPlaceholder="Search by code or name..."
        filters={[
          {
            key: "category",
            label: "All Categories",
            options: [
              { value: "Cable Runs", label: "Cable Runs" },
              { value: "Services", label: "Services" },
              { value: "Centralization", label: "Centralization" },
              { value: "Deposits", label: "Deposits" },
              { value: "Equipment", label: "Equipment" },
            ],
          },
          {
            key: "status",
            label: "All Statuses",
            options: [
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
            ],
          },
        ]}
        isLoading={loading}
      />

      {(showCreate || editItem) && (
        <CostItemModal
          item={editItem}
          onClose={() => { setEditItem(null); setShowCreate(false); }}
          onSaved={() => { setEditItem(null); setShowCreate(false); fetchData(); }}
        />
      )}
    </div>
  );
}

function LaborRateControl({ rate, onSave }: { rate: number; onSave: (r: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(rate.toString());

  useEffect(() => setValue(rate.toString()), [rate]);

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:bg-surface-light transition-colors"
      >
        Labor: ${rate}/hr
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-20 rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:border-green focus:outline-none"
      />
      <button
        onClick={() => { onSave(parseFloat(value) || 0); setEditing(false); }}
        className="rounded-lg bg-green/20 px-2 py-1.5 text-xs text-green"
      >
        Save
      </button>
      <button
        onClick={() => setEditing(false)}
        className="rounded-lg px-2 py-1.5 text-xs text-muted"
      >
        Cancel
      </button>
    </div>
  );
}

function CostItemModal({
  item,
  onClose,
  onSaved,
}: {
  item: CostItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    code: item?.code || "",
    name: item?.name || "",
    description: item?.description || "",
    category: item?.category || "Equipment",
    unitType: item?.unitType || "per-unit",
    unitLabel: item?.unitLabel || "",
    price: item?.price?.toString() || "0",
    materialCost: item?.materialCost?.toString() || "0",
    laborHours: item?.laborHours?.toString() || "0",
    sortOrder: item?.sortOrder?.toString() || "0",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function updateField(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit() {
    setSaving(true);
    setError("");
    try {
      const data = {
        ...form,
        price: parseFloat(form.price) || 0,
        materialCost: parseFloat(form.materialCost) || 0,
        laborHours: parseFloat(form.laborHours) || 0,
        sortOrder: parseInt(form.sortOrder) || 0,
      };

      if (item) {
        await adminApi.updateCostItem(item._id, data);
      } else {
        await adminApi.createCostItem(data);
      }
      onSaved();
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-xl border border-border bg-surface p-6">
        <h3 className="mb-4 text-lg font-medium text-foreground">
          {item ? "Edit Cost Item" : "New Cost Item"}
        </h3>

        {error && (
          <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <ModalField label="Code" value={form.code} onChange={(v) => updateField("code", v)} />
            <ModalField label="Name" value={form.name} onChange={(v) => updateField("name", v)} />
          </div>
          <ModalField label="Description" value={form.description} onChange={(v) => updateField("description", v)} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-muted">Category</label>
              <select
                value={form.category}
                onChange={(e) => updateField("category", e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-green focus:outline-none"
              >
                {["Cable Runs", "Services", "Centralization", "Deposits", "Equipment"].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Unit Type</label>
              <select
                value={form.unitType}
                onChange={(e) => updateField("unitType", e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-green focus:outline-none"
              >
                {["per-unit", "per-run", "flat-fee", "threshold"].map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <ModalField label="Price" value={form.price} onChange={(v) => updateField("price", v)} type="number" />
            <ModalField label="Material $" value={form.materialCost} onChange={(v) => updateField("materialCost", v)} type="number" />
            <ModalField label="Labor Hrs" value={form.laborHours} onChange={(v) => updateField("laborHours", v)} type="number" />
            <ModalField label="Sort Order" value={form.sortOrder} onChange={(v) => updateField("sortOrder", v)} type="number" />
          </div>
          <ModalField label="Unit Label" value={form.unitLabel} onChange={(v) => updateField("unitLabel", v)} />
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm text-muted hover:bg-surface-light transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="rounded-lg bg-green/20 px-4 py-2 text-sm text-green hover:bg-green/30 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : item ? "Update" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-muted">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-green focus:outline-none focus:ring-1 focus:ring-green"
      />
    </div>
  );
}

export default function CostItemsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading...</p>}>
      <CostItemsContent />
    </Suspense>
  );
}
