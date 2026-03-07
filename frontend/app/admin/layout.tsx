"use client";

import { usePathname } from "next/navigation";
import { AuthProvider } from "@/lib/admin/auth-context";
import { Sidebar } from "@/components/admin/Sidebar";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/admin/login";

  if (isLoginPage) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        {children}
      </div>
    );
  }

  return (
    <AuthProvider>
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <main className="ml-60 flex-1 p-6">{children}</main>
      </div>
    </AuthProvider>
  );
}
