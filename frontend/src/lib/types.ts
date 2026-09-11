// TypeScript mirror of the backend API response shapes (Prisma 7 / NestJS).
// Verified against backend source: src/tickets, src/approvals, src/auth, src/analytics.

export type TicketStatus =
  | "OPEN"
  | "PROCESSING"
  | "WAITING_APPROVAL"
  | "RESOLVED"
  | "REJECTED"
  | "FAILED";

export type Intent =
  | "REFUND"
  | "ORDER_STATUS"
  | "DAMAGED_ORDER"
  | "CANCEL_ORDER"
  | "TECHNICAL_ISSUE"
  | "OTHER";

export type Priority = "LOW" | "MEDIUM" | "HIGH";

export type DecisionAction =
  | "AUTO_REFUND"
  | "REQUEST_HUMAN_APPROVAL"
  | "REJECT_REFUND"
  | "ORDER_NOT_FOUND"
  | "NEEDS_HUMAN_REVIEW"
  | "NO_ACTION";

// backend DecisionReason is a wide string union; keep it loose here
export type DecisionReason = string;

export interface Ticket {
  id: string;
  customerId: string | null;
  message: string;
  source: string;
  intent: Intent | null;
  priority: Priority | null;
  confidence: number | null;
  orderId: string | null;
  aiResponse: string | null;
  aiMetadata: Record<string, unknown> | null;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
}

// backend AuditActor enum is AI | HUMAN | SYSTEM (approvals emit HUMAN)
export type AuditActor = "AI" | "HUMAN" | "SYSTEM" | "AGENT";

export interface AuditLogEntry {
  id: string;
  ticketId: string | null;
  event: string;
  actor: AuditActor;
  actorId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

// backend RefundStatus enum: PENDING | PROCESSING | COMPLETED | FAILED
export type RefundStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

export interface Refund {
  id: string;
  ticketId: string;
  orderId: string;
  amount: string; // Decimal serialized as string
  currency: string;
  status: RefundStatus;
  reason: string;
  approvedById: string | null;
  createdAt: string;
  updatedAt: string;
}

// backend ApprovalStatus enum: PENDING | APPROVED | REJECTED
export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";
// backend ApprovalType enum: REFUND | CANCEL_ORDER
export type ApprovalType = "REFUND" | "CANCEL_ORDER";

export interface Approval {
  id: string;
  ticketId: string;
  type: ApprovalType;
  amount: string | null;
  reason: string;
  status: ApprovalStatus;
  decidedById: string | null;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
  // included by GET /approvals (include: { ticket: true })
  ticket?: Ticket;
}

// GET /tickets and GET /tickets/:id return the ticket with singular
// `refund` / `approvalRequest` relations and an ascending auditLogs array.
export interface TicketDetail extends Ticket {
  refund: Refund | null;
  approvalRequest: Approval | null;
  auditLogs: AuditLogEntry[];
}

// backend TicketClassification — intents/priorities are lowercase here
export interface TicketClassification {
  intent:
    | "refund"
    | "order_status"
    | "damaged_order"
    | "cancel_order"
    | "technical_issue"
    | "other";
  orderId: string | null;
  priority: "low" | "medium" | "high";
  confidence: number;
}

export interface Decision {
  action: DecisionAction;
  reason: DecisionReason;
  amount: number | null;
  requiresApproval: boolean;
  confidence: number;
}

// POST /tickets returns the full workflow result (ProcessResult). The
// embedded `ticket` is a minimal { id, status } projection.
export interface ProcessResult {
  ticket: { id: string; status: string };
  classification: TicketClassification | null;
  decision: Decision | null;
  refund: Refund | null;
  approval: Approval | null;
  response: string | null;
  error?: string;
}

export type Role = "ADMIN" | "AGENT" | "CUSTOMER";

// backend SafeUser = Omit<User, 'passwordHash' | 'refreshTokenHash'>
export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  customerId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LoginResponse {
  user: User;
  tokens: { accessToken: string; refreshToken: string };
}

export interface AnalyticsResponse {
  tickets: {
    total: number;
    resolved: number;
    waitingApproval: number;
    failed: number;
    open: number;
  };
  automation: {
    automatedCount: number;
    escalatedCount: number;
    rejectedCount: number;
    automationRate: number;
  };
  approvals: { pending: number; approved: number; rejected: number };
  refunds: { count: number; totalAmount: number; currency: string };
  ai: { averageConfidence: number; providerCounts: Record<string, number> };
}

export interface SeedTestOrderResult {
  orderId: string;
  amount: number;
  currency: string;
  status: string;
  deliveredAt: string | null;
}
