import { describe, expect, it } from 'vitest';
import { MockProvider } from './mock.provider.js';

describe('MockProvider', () => {
  const provider = new MockProvider();

  it('classifies damaged/broken orders as damaged_order with high priority', async () => {
    const result = await provider.classifyTicket(
      'My order #123 arrived damaged. I want a refund.',
    );
    expect(result).toEqual({
      intent: 'damaged_order',
      orderId: '123',
      priority: 'high',
      confidence: 0.95,
    });
  });

  it('classifies broken items as damaged_order', async () => {
    const result = await provider.classifyTicket('my screen is broken');
    expect(result.intent).toBe('damaged_order');
    expect(result.priority).toBe('high');
    expect(result.confidence).toBe(0.95);
  });

  it('classifies a plain refund request as refund', async () => {
    const result = await provider.classifyTicket(
      'I want a refund on order 123',
    );
    expect(result.intent).toBe('refund');
    expect(result.priority).toBe('high');
    expect(result.confidence).toBe(0.95);
  });

  it('classifies "where is my order" as order_status', async () => {
    const result = await provider.classifyTicket('Where is my order #456?');
    expect(result).toEqual({
      intent: 'order_status',
      orderId: '456',
      priority: 'medium',
      confidence: 0.9,
    });
  });

  it('classifies cancel requests as cancel_order', async () => {
    const result = await provider.classifyTicket('Please cancel order 789');
    expect(result.intent).toBe('cancel_order');
    expect(result.priority).toBe('medium');
    expect(result.confidence).toBe(0.9);
  });

  it('classifies error/bug mentions as technical_issue', async () => {
    const result = await provider.classifyTicket(
      'I hit an error when checking out',
    );
    expect(result.intent).toBe('technical_issue');
    expect(result.priority).toBe('medium');
    expect(result.confidence).toBe(0.85);
  });

  it('classifies unknown messages as other with low priority', async () => {
    const result = await provider.classifyTicket('hello there');
    expect(result).toEqual({
      intent: 'other',
      orderId: null,
      priority: 'low',
      confidence: 0.5,
    });
  });

  it('extracts order ids from #-prefixed and plain numbers', async () => {
    const hashed = await provider.classifyTicket('Where is #123?');
    const plain = await provider.classifyTicket('order 456 please');
    const none = await provider.classifyTicket('hello');

    expect(hashed.orderId).toBe('123');
    expect(plain.orderId).toBe('456');
    expect(none.orderId).toBeNull();
  });
});
