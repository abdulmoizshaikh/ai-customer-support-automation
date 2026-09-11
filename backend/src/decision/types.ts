import type { Intent, Priority } from '../ai/types/ticket-classification.js';

export interface OrderSnapshot {
  id: string;
  amount: number;
  currency: string;
  status: string;
  deliveredAt: Date | null;
  hasCompletedRefund?: boolean;
}

export interface PolicyConfig {
  refundWindowDays: number;
  autoRefundThreshold: number;
  confidenceThreshold: number;
}

export type DecisionAction =
  | 'AUTO_REFUND'
  | 'REQUEST_HUMAN_APPROVAL'
  | 'REJECT_REFUND'
  | 'ORDER_NOT_FOUND'
  | 'NEEDS_HUMAN_REVIEW'
  | 'NO_ACTION';

export type DecisionReason =
  | 'ELIGIBLE'
  | 'OUTSIDE_REFUND_WINDOW'
  | 'AMOUNT_EXCEEDS_AUTO_THRESHOLD'
  | 'ORDER_NOT_FOUND'
  | 'ORDER_NOT_DELIVERED'
  | 'LOW_CONFIDENCE'
  | 'INTENT_NOT_REFUND'
  | 'NOT_DAMAGED'
  | 'DIGITAL_PRODUCT_NON_REFUNDABLE'
  | 'ORDER_ALREADY_REFUNDED';

export interface DecisionInput {
  intent: Intent;
  priority: Priority;
  confidence: number;
  orderId: string | null;
  order: OrderSnapshot | null;
  policy: PolicyConfig;
  now?: Date;
}

export interface Decision {
  action: DecisionAction;
  reason: DecisionReason;
  amount: number | null;
  requiresApproval: boolean;
  notes: string[];
}
