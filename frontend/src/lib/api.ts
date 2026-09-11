import type {
  AnalyticsResponse,
  Approval,
  LoginResponse,
  ProcessResult,
  Refund,
  SeedTestOrderResult,
  Ticket,
  TicketDetail,
  User,
} from "./types";
import { clearAuth, getToken } from "./auth";

const BASE = "/api";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...init, headers });

  if (res.status === 401) {
    clearAuth();
    if (window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
  }

  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = (await res.json()) as { message?: unknown };
      if (typeof body.message === "string") message = body.message;
    } catch {
      // ignore body parse errors — fall back to statusText
    }
    throw new ApiError(res.status, message);
  }

  return res.json() as Promise<T>;
}

export const api = {
  login: (email: string, password: string) =>
    request<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  submitTicket: (message: string) =>
    request<ProcessResult>("/tickets", {
      method: "POST",
      body: JSON.stringify({ message }),
    }),

  listTickets: () => request<TicketDetail[]>("/tickets"),

  getTicket: (id: string) => request<TicketDetail>(`/tickets/${id}`),

  retryTicket: (id: string) =>
    request<ProcessResult>(`/tickets/${id}/retry`, { method: "POST" }),

  listApprovals: (status = "PENDING") =>
    request<Approval[]>(`/approvals?status=${status}`),

  approve: (id: string) =>
    request<{ approval: Approval; refund: Refund; ticket: Ticket }>(
      `/approvals/${id}/approve`,
      { method: "POST" },
    ),

  reject: (id: string, reason?: string) =>
    request<{ approval: Approval; ticket: Ticket }>(`/approvals/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),

  analytics: () => request<AnalyticsResponse>("/analytics"),

  seedTestOrder: (amount?: number) =>
    request<SeedTestOrderResult>("/admin/seed-test-order", {
      method: "POST",
      body: amount ? JSON.stringify({ amount }) : undefined,
    }),

  me: () => request<User>("/auth/me"),
};
