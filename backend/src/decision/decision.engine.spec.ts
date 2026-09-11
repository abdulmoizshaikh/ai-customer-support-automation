import { describe, expect, it } from 'vitest';
import { evaluateDecision } from './decision.engine.js';
import { DEFAULT_POLICY } from './policy.js';
import type { DecisionInput, OrderSnapshot } from './types.js';

const NOW = new Date('2026-09-11T12:00:00Z');
const policy = DEFAULT_POLICY;

function order(overrides: Partial<OrderSnapshot> = {}): OrderSnapshot {
  return {
    id: '123',
    amount: 100,
    currency: 'USD',
    status: 'delivered',
    deliveredAt: new Date(NOW.getTime() - 2 * 24 * 60 * 60 * 1000),
    ...overrides,
  };
}

function input(overrides: Partial<DecisionInput> = {}): DecisionInput {
  return {
    intent: 'refund',
    priority: 'high',
    confidence: 0.95,
    orderId: '123',
    order: order(),
    policy,
    now: NOW,
    ...overrides,
  };
}

describe('evaluateDecision', () => {
  it('auto-refunds a low-value damaged order within window', () => {
    const d = evaluateDecision(input());
    expect(d.action).toBe('AUTO_REFUND');
    expect(d.reason).toBe('ELIGIBLE');
    expect(d.amount).toBe(100);
    expect(d.requiresApproval).toBe(false);
  });

  it('requires human approval for high-value orders', () => {
    const d = evaluateDecision(input({ order: order({ amount: 2500 }) }));
    expect(d.action).toBe('REQUEST_HUMAN_APPROVAL');
    expect(d.reason).toBe('AMOUNT_EXCEEDS_AUTO_THRESHOLD');
    expect(d.requiresApproval).toBe(true);
    expect(d.amount).toBe(2500);
  });

  it('rejects refunds outside the window', () => {
    const old = new Date(NOW.getTime() - 45 * 24 * 60 * 60 * 1000);
    const d = evaluateDecision(input({ order: order({ deliveredAt: old }) }));
    expect(d.action).toBe('REJECT_REFUND');
    expect(d.reason).toBe('OUTSIDE_REFUND_WINDOW');
    expect(d.requiresApproval).toBe(false);
  });

  it('returns ORDER_NOT_FOUND when order is null', () => {
    const d = evaluateDecision(input({ order: null }));
    expect(d.action).toBe('ORDER_NOT_FOUND');
    expect(d.reason).toBe('ORDER_NOT_FOUND');
  });

  it('routes to human review on low confidence', () => {
    const d = evaluateDecision(input({ confidence: 0.4 }));
    expect(d.action).toBe('NEEDS_HUMAN_REVIEW');
    expect(d.reason).toBe('LOW_CONFIDENCE');
    expect(d.requiresApproval).toBe(true);
  });

  it('does nothing for non-refund intents', () => {
    const d = evaluateDecision(input({ intent: 'order_status', order: null }));
    expect(d.action).toBe('NO_ACTION');
    expect(d.reason).toBe('INTENT_NOT_REFUND');
  });

  it('rejects refunds for orders not yet delivered', () => {
    const d = evaluateDecision(
      input({ order: order({ status: 'shipped', deliveredAt: null }) }),
    );
    expect(d.action).toBe('REJECT_REFUND');
    expect(d.reason).toBe('ORDER_NOT_DELIVERED');
  });

  it('handles damaged_order intent the same as refund intent', () => {
    const d = evaluateDecision(
      input({ intent: 'damaged_order', order: order({ amount: 750 }) }),
    );
    expect(d.action).toBe('REQUEST_HUMAN_APPROVAL');
    expect(d.reason).toBe('AMOUNT_EXCEEDS_AUTO_THRESHOLD');
  });

  it('exactly at auto threshold auto-refunds', () => {
    const d = evaluateDecision(input({ order: order({ amount: 500 }) }));
    expect(d.action).toBe('AUTO_REFUND');
    expect(d.reason).toBe('ELIGIBLE');
  });

  it('one cent above threshold requires approval', () => {
    const d = evaluateDecision(input({ order: order({ amount: 500.01 }) }));
    expect(d.action).toBe('REQUEST_HUMAN_APPROVAL');
  });

  it('exactly at refund window boundary auto-refunds', () => {
    const exactly30 = new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000);
    const d = evaluateDecision(
      input({ order: order({ deliveredAt: exactly30 }) }),
    );
    expect(d.action).toBe('AUTO_REFUND');
  });

  it('one day outside window rejects', () => {
    const thirtyOne = new Date(NOW.getTime() - 31 * 24 * 60 * 60 * 1000);
    const d = evaluateDecision(
      input({ order: order({ deliveredAt: thirtyOne }) }),
    );
    expect(d.action).toBe('REJECT_REFUND');
    expect(d.reason).toBe('OUTSIDE_REFUND_WINDOW');
  });

  it('exactly at confidence threshold proceeds', () => {
    const d = evaluateDecision(input({ confidence: 0.85 }));
    expect(d.action).toBe('AUTO_REFUND');
  });

  it('one point below confidence threshold routes to human', () => {
    const d = evaluateDecision(input({ confidence: 0.84 }));
    expect(d.action).toBe('NEEDS_HUMAN_REVIEW');
  });

  it('confidence gate is checked before order lookup', () => {
    const d = evaluateDecision(input({ confidence: 0.4, order: null }));
    expect(d.action).toBe('NEEDS_HUMAN_REVIEW');
    expect(d.reason).toBe('LOW_CONFIDENCE');
  });

  it('order-not-found is checked before window', () => {
    const d = evaluateDecision(input({ order: null }));
    expect(d.action).toBe('ORDER_NOT_FOUND');
  });
});
