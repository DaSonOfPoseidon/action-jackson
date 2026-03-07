const BASE = "/api/admin";

class AdminApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...options.headers,
    },
  });

  if (res.status === 401) {
    // Try refreshing the token
    const refreshRes = await fetch("/auth/refresh", {
      method: "POST",
      credentials: "include",
    });

    if (refreshRes.ok) {
      // Retry original request
      const retryRes = await fetch(`${BASE}${path}`, {
        ...options,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...options.headers,
        },
      });

      if (retryRes.ok) {
        return retryRes.json();
      }
    }

    // Refresh failed — redirect to login
    window.location.href = "/admin/login";
    throw new AdminApiError("Session expired", 401);
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: "Request failed" }));
    throw new AdminApiError(data.error || "Request failed", res.status);
  }

  return res.json();
}

export const adminApi = {
  // Dashboard
  getDashboard: () => request("/dashboard"),

  // Quotes
  getQuotes: (params?: URLSearchParams) =>
    request(`/quotes${params ? `?${params}` : ""}`),
  getQuote: (id: string) => request(`/quotes/${id}`),
  updateQuote: (id: string, data: Record<string, unknown>) =>
    request(`/quotes/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  updateQuoteStatus: (id: string, status: string) =>
    request(`/quotes/${id}/status`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    }),
  convertQuoteToInvoice: (id: string, data: Record<string, unknown>) =>
    request(`/quotes/${id}/convert-to-invoice`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteQuote: (id: string) =>
    request(`/quotes/${id}`, { method: "DELETE" }),

  // Schedule
  getSchedules: (params?: URLSearchParams) =>
    request(`/schedule${params ? `?${params}` : ""}`),
  getSchedule: (id: string) => request(`/schedule/${id}`),
  updateScheduleStatus: (id: string, status: string) =>
    request(`/schedule/${id}/status`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    }),
  deleteSchedule: (id: string) =>
    request(`/schedule/${id}`, { method: "DELETE" }),

  // Invoices
  getInvoices: (params?: URLSearchParams) =>
    request(`/invoices${params ? `?${params}` : ""}`),
  getInvoice: (id: string) => request(`/invoices/${id}`),
  updateInvoiceStatus: (id: string, status: string) =>
    request(`/invoices/${id}/status`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    }),
  deleteInvoice: (id: string) =>
    request(`/invoices/${id}`, { method: "DELETE" }),

  // Cost Items
  getCostItems: (params?: URLSearchParams) =>
    request(`/cost-items${params ? `?${params}` : ""}`),
  searchCostItems: (q: string, exclude?: string) =>
    request(
      `/cost-items/search?q=${encodeURIComponent(q)}${exclude ? `&exclude=${exclude}` : ""}`
    ),
  createCostItem: (data: Record<string, unknown>) =>
    request("/cost-items", { method: "POST", body: JSON.stringify(data) }),
  updateCostItem: (id: string, data: Record<string, unknown>) =>
    request(`/cost-items/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  toggleCostItem: (id: string) =>
    request(`/cost-items/${id}/toggle`, { method: "PUT" }),
  deleteCostItem: (id: string) =>
    request(`/cost-items/${id}`, { method: "DELETE" }),
  seedCostItems: () =>
    request("/cost-items/seed", { method: "POST" }),

  // Settings
  getLaborRate: () => request("/settings/labor-rate"),
  updateLaborRate: (laborRate: number) =>
    request("/settings/labor-rate", {
      method: "PUT",
      body: JSON.stringify({ laborRate }),
    }),

  // Consultations
  getConsultations: (params?: URLSearchParams) =>
    request(`/consultations${params ? `?${params}` : ""}`),
  getConsultation: (id: string) => request(`/consultations/${id}`),
  updateConsultation: (id: string, data: Record<string, unknown>) =>
    request(`/consultations/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};
