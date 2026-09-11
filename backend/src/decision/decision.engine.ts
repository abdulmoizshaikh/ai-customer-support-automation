import type { Decision, DecisionInput } from './types.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export function evaluateDecision(input: DecisionInput): Decision {
  const { intent, confidence, order, policy } = input;
  const now = input.now ?? new Date();
  const notes: string[] = [];

  const refundIntents = new Set(['refund', 'damaged_order']);
  if (!refundIntents.has(intent)) {
    return {
      action: 'NO_ACTION',
      reason: 'INTENT_NOT_REFUND',
      amount: null,
      requiresApproval: false,
      notes: [`Intent "${intent}" does not trigger refund evaluation.`],
    };
  }

  if (confidence < policy.confidenceThreshold) {
    notes.push(
      `Confidence ${confidence} below threshold ${policy.confidenceThreshold}.`,
    );
    return {
      action: 'NEEDS_HUMAN_REVIEW',
      reason: 'LOW_CONFIDENCE',
      amount: null,
      requiresApproval: true,
      notes,
    };
  }

  if (!order) {
    return {
      action: 'ORDER_NOT_FOUND',
      reason: 'ORDER_NOT_FOUND',
      amount: null,
      requiresApproval: false,
      notes: ['Order could not be located.'],
    };
  }

  if (order.status.toLowerCase() === 'refunded' || order.hasCompletedRefund) {
    return {
      action: 'REJECT_REFUND',
      reason: 'ORDER_ALREADY_REFUNDED',
      amount: order.amount,
      requiresApproval: false,
      notes: ['Order has already been refunded.'],
    };
  }

  if (order.status !== 'delivered' || !order.deliveredAt) {
    return {
      action: 'REJECT_REFUND',
      reason: 'ORDER_NOT_DELIVERED',
      amount: order.amount,
      requiresApproval: false,
      notes: [`Order status is "${order.status}", not delivered.`],
    };
  }

  const daysSinceDelivery = Math.floor(
    (now.getTime() - order.deliveredAt.getTime()) / DAY_MS,
  );
  if (daysSinceDelivery > policy.refundWindowDays) {
    return {
      action: 'REJECT_REFUND',
      reason: 'OUTSIDE_REFUND_WINDOW',
      amount: order.amount,
      requiresApproval: false,
      notes: [
        `Delivered ${daysSinceDelivery} days ago; window is ${policy.refundWindowDays}.`,
      ],
    };
  }

  if (intent === 'refund' && !refundIntents.has('damaged_order')) {
    notes.push('Standard refund path (not explicitly damaged).');
  }

  if (order.amount > policy.autoRefundThreshold) {
    return {
      action: 'REQUEST_HUMAN_APPROVAL',
      reason: 'AMOUNT_EXCEEDS_AUTO_THRESHOLD',
      amount: order.amount,
      requiresApproval: true,
      notes: [
        ...notes,
        `Amount ${order.amount} > auto threshold ${policy.autoRefundThreshold}.`,
      ],
    };
  }

  return {
    action: 'AUTO_REFUND',
    reason: 'ELIGIBLE',
    amount: order.amount,
    requiresApproval: false,
    notes,
  };
}
