"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/admin/auth-context";

const navItems = [
  { label: "Dashboard", href: "/admin", icon: "fa-chart-line" },
  { label: "Quotes", href: "/admin/quotes", icon: "fa-file-invoice-dollar" },
  { label: "Schedule", href: "/admin/schedule", icon: "fa-calendar-alt" },
  { label: "Consultations", href: "/admin/consultations", icon: "fa-comments" },
  { label: "Invoices", href: "/admin/invoices", icon: "fa-receipt" },
  { label: "Cost Items", href: "/admin/cost-items", icon: "fa-boxes-stacked" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  function isActive(href: string) {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  }

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-60 flex-col border-r border-border bg-surface">
      <div className="flex items-center gap-2 border-b border-border px-5 py-4">
        <i className="fas fa-network-wired text-sm text-green" />
        <span className="font-heading text-sm font-bold text-foreground">
          Admin Panel
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  isActive(item.href)
                    ? "bg-green/10 text-green font-medium"
                    : "text-muted hover:bg-surface-light hover:text-foreground"
                }`}
              >
                <i className={`fas ${item.icon} w-4 text-center text-xs`} />
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="border-t border-border px-3 py-4 space-y-2">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-light hover:text-foreground transition-colors"
        >
          <i className="fas fa-external-link-alt w-4 text-center text-xs" />
          View Site
        </Link>
        {user && (
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-xs text-muted truncate">{user.username}</span>
            <button
              onClick={logout}
              className="text-xs text-muted hover:text-red-400 transition-colors"
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
