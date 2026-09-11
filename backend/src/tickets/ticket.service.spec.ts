import { describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { AiService } from '../ai/ai.service.js';
import { MockProvider } from '../ai/providers/mock.provider.js';
import { RagService } from '../rag/rag.service.js';
import { DecisionService } from '../decision/decision.service.js';
import { TicketService } from './ticket.service.js';

const daysAgo = (days: number): Date =>
  new Date(Date.now() - days * 86_400_000);

function orderFixture(id: string, amount: number, deliveredDaysAgo: number) {
  return {
    id,
    customerId: `customer-${id}`,
    status: 'DELIVERED',
    amount: String(amount),
    currency: 'USD',
    deliveredAt: daysAgo(deliveredDaysAgo),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

interface MockContext {
  service: TicketService;
  tx: {
    ticket: {
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    order: {
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    refund: {
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
    };
    approvalRequest: { create: ReturnType<typeof vi.fn> };
    auditLog: { create: ReturnType<typeof vi.fn> };
  };
  refundsByTicket: Map<string, { id: string; status: string }>;
}

function createContext(): MockContext {
  const refundsByTicket = new Map<string, { id: string; status: string }>();

  const tx = {
    ticket: {
      create: vi.fn(),
      update: vi.fn(async ({ where, data }: never) => ({
        id: where.id,
        ...data,
      })),
    },
    order: { findUnique: vi.fn(), update: vi.fn() },
    refund: {
      findUnique: vi.fn(
        ({ where }: never) => refundsByTicket.get(where.ticketId) ?? null,
      ),
      create: vi.fn(async ({ data }: never) => {
        const refund = { id: `refund-${refundsByTicket.size + 1}`, ...data };
        refundsByTicket.set(data.ticketId, refund);
        return refund;
      }),
    },
    approvalRequest: {
      create: vi.fn(async ({ data }: never) => ({
        id: 'approval-1',
        ...data,
      })),
    },
    auditLog: { create: vi.fn() },
  };

  const prisma = {
    ticket: {
      create: vi.fn(async ({ data }: never) => ({ id: 'ticket-1', ...data })),
      update: vi.fn(async ({ where, data }: never) => ({
        id: where.id,
        ...data,
      })),
    },
    $transaction: vi.fn(async (cb: never) => cb(tx)),
  } as unknown as PrismaService;

  const ai = new AiService(new MockProvider());
  const rag = {
    searchKnowledge: vi.fn(async () => []),
  } as unknown as RagService;
  const decision = new DecisionService();
  const audit = new AuditService({} as unknown as PrismaService);
  const service = new TicketService(prisma, ai, rag, decision, audit);

  return {
    service,
    tx,
    refundsByTicket,
  };
}

describe('TicketService.processTicket', () => {
  it('auto-refunds Order 124 ($100, damaged, 1 day ago) and resolves', async () => {
    const ctx = createContext();
    ctx.tx.order.findUnique.mockImplementation(async () =>
      orderFixture('124', 100, 1),
    );

    const result = await ctx.service.processTicket(
      'My order #124 arrived damaged. I want a refund.',
    );

    expect(result.decision?.action).toBe('AUTO_REFUND');
    expect(result.refund).toBeTruthy();
    expect(result.refund?.status).toBe('COMPLETED');
    expect(result.ticket?.status).toBe('RESOLVED');
    expect(result.error).toBeUndefined();
    expect(ctx.refundsByTicket.size).toBe(1);
    expect(ctx.tx.order.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'REFUNDED' } }),
    );
  });

  it('requests human approval for Order 123 ($750) and waits', async () => {
    const ctx = createContext();
    ctx.tx.order.findUnique.mockImplementation(async () =>
      orderFixture('123', 750, 1),
    );

    const result = await ctx.service.processTicket(
      'My order #123 arrived damaged. I want a refund.',
    );

    expect(result.decision?.action).toBe('REQUEST_HUMAN_APPROVAL');
    expect(result.approval).toBeTruthy();
    expect(ctx.tx.approvalRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'PENDING' }),
      }),
    );
    expect(result.ticket?.status).toBe('WAITING_APPROVAL');
    expect(ctx.refundsByTicket.size).toBe(0);
    expect(ctx.tx.order.update).not.toHaveBeenCalled();
  });

  it('rejects Order 125 ($2200) outside the refund window', async () => {
    const ctx = createContext();
    ctx.tx.order.findUnique.mockImplementation(async () =>
      orderFixture('125', 2200, 45),
    );

    const result = await ctx.service.processTicket(
      'My order #125 arrived damaged. I want a refund.',
    );

    expect(result.decision?.action).toBe('REJECT_REFUND');
    expect(result.decision?.reason).toBe('OUTSIDE_REFUND_WINDOW');
    expect(result.refund).toBeNull();
    expect(result.approval).toBeNull();
    expect(result.ticket?.status).toBe('RESOLVED');
    expect(ctx.refundsByTicket.size).toBe(0);
  });

  it('returns ORDER_NOT_FOUND for a nonexistent order', async () => {
    const ctx = createContext();
    ctx.tx.order.findUnique.mockImplementation(async () => null);

    const result = await ctx.service.processTicket(
      'My order #99999 arrived damaged. I want a refund.',
    );

    expect(result.decision?.action).toBe('ORDER_NOT_FOUND');
    expect(result.ticket?.status).toBe('RESOLVED');
    expect(result.refund).toBeNull();
    expect(result.approval).toBeNull();
    expect(ctx.refundsByTicket.size).toBe(0);
  });

  it('takes no action for a non-refund intent (order status)', async () => {
    const ctx = createContext();
    ctx.tx.order.findUnique.mockImplementation(async () =>
      orderFixture('456', 50, 10),
    );

    const result = await ctx.service.processTicket('Where is my order #456?');

    expect(result.decision?.action).toBe('NO_ACTION');
    expect(result.decision?.reason).toBe('INTENT_NOT_REFUND');
    expect(result.ticket?.status).toBe('RESOLVED');
    expect(result.refund).toBeNull();
    expect(result.approval).toBeNull();
    expect(ctx.refundsByTicket.size).toBe(0);
  });

  it('does not duplicate a refund when the same ticket is re-processed', async () => {
    const ctx = createContext();
    ctx.tx.order.findUnique.mockImplementation(async () =>
      orderFixture('124', 100, 1),
    );
    const message = 'My order #124 arrived damaged. I want a refund.';

    const first = await ctx.service.processTicket(message);
    const second = await ctx.service.processTicket(message);

    expect(first.decision?.action).toBe('AUTO_REFUND');
    expect(second.decision?.action).toBe('AUTO_REFUND');
    expect(ctx.tx.refund.create).toHaveBeenCalledTimes(1);
    expect(ctx.refundsByTicket.size).toBe(1);
  });
});
