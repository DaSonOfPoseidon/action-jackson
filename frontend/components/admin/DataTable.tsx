"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";

export interface Column<T> {
  key: string;
  label: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyField?: string;
  onRowClick?: (item: T) => void;
  pagination?: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
  };
  searchPlaceholder?: string;
  filters?: {
    key: string;
    label: string;
    options: { value: string; label: string }[];
  }[];
  emptyMessage?: string;
  isLoading?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  keyField = "_id",
  onRowClick,
  pagination,
  searchPlaceholder = "Search...",
  filters,
  emptyMessage = "No data found",
  isLoading,
}: DataTableProps<T>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const updateParams = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      if (key !== "page") params.delete("page");
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const currentSearch = searchParams.get("search") || "";

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            defaultValue={currentSearch}
            onChange={(e) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const w = window as any;
              clearTimeout(w.__searchTimeout);
              w.__searchTimeout = setTimeout(
                () => updateParams("search", e.target.value),
                300
              );
            }}
            className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted/50 focus:border-green focus:outline-none focus:ring-1 focus:ring-green"
          />
        </div>
        {filters?.map((filter) => (
          <select
            key={filter.key}
            value={searchParams.get(filter.key) || ""}
            onChange={(e) => updateParams(filter.key, e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-green focus:outline-none focus:ring-1 focus:ring-green"
          >
            <option value="">{filter.label}</option>
            {filter.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-surface">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted ${col.className || ""}`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-sm text-muted"
                >
                  Loading...
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-sm text-muted"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((item) => (
                <tr
                  key={item[keyField] as string}
                  onClick={() => onRowClick?.(item)}
                  className={`transition-colors hover:bg-surface-light ${
                    onRowClick ? "cursor-pointer" : ""
                  }`}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-4 py-3 text-sm text-foreground ${col.className || ""}`}
                    >
                      {col.render
                        ? col.render(item)
                        : (item[col.key] as React.ReactNode) ?? "—"}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted">
            Page {pagination.currentPage} of {pagination.totalPages} ({pagination.totalCount} total)
          </p>
          <div className="flex items-center gap-2">
            <button
              disabled={pagination.currentPage <= 1}
              onClick={() =>
                updateParams("page", String(pagination.currentPage - 1))
              }
              className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted transition-colors hover:bg-surface-light disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              disabled={pagination.currentPage >= pagination.totalPages}
              onClick={() =>
                updateParams("page", String(pagination.currentPage + 1))
              }
              className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted transition-colors hover:bg-surface-light disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
