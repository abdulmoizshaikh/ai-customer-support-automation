import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { RefundsService } from '../refunds/refunds.service.js';
import { ApprovalsService } from './approvals.service.js';

interface ApprovalFixtureInput {
  id: string;
  status: string;
}

function approvalFixture(
  { id, status }: ApprovalFixtureInput,
  ticketId = 'ticket-1',
) {
  return {
    id,
    ticketId,
    type: 'REFUND',
    amount: 750,
    reason: 'AMOUNT_EXCEEDS_AUTO_THRESHOLD',
    status,
    decidedById: null,
    decidedAt: null,
  };
}

interface MockContext {
  service: ApprovalsService;
  tx: {
    approvalRequest: {
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    ticket: {
      findUnique: ReturnType<typeof vi.fn>;
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
    user: { findUnique: ReturnType<typeof vi.fn> };
    auditLog: { create: ReturnType<typeof vi.fn> };
  };
  prismaList: ReturnType<typeof vi.fn>;
  events: () => string[];
}

function createContext(initialStatus = 'PENDING'): MockContext {
  const refundsByTicket = new Map<string, { id: string; status: string }>();

  const tx = {
    approvalRequest: {
      findUnique: vi.fn(),
      update: vi.fn(async ({ where, data }: never) => ({
        id: where.id,
        ...data,
        type: 'REFUND',
        amount: 750,
        reason: 'AMOUNT_EXCEEDS_AUTO_THRESHOLD',
      })),
    },
    ticket: {
      findUnique: vi.fn(async () => ({
        id: 'ticket-1',
        orderId: '123',
        status: 'WAITING_APPROVAL',
      })),
      update: vi.fn(async ({ where, data }: never) => ({
        id: where.id,
        orderId: '123',
        ...data,
      })),
    },
    order: {
      findUnique: vi.fn(async () => ({
        id: '123',
        status: 'DELIVERED',
        amount: '750.00',
        currency: 'USD',
      })),
      update: vi.fn(async ({ where, data }: never) => ({
        id: where.id,
        ...data,
      })),
    },
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
    user: {
      findUnique: vi.fn(async ({ where }: never) => ({
        id: 'agent-user-1',
        email: where.email,
      })),
    },
    auditLog: { create: vi.fn(async () => undefined) },
  };

  const prisma = {
    approvalRequest: {
      findUnique: vi.fn(async ({ where }: never) =>
        approvalFixture({ id: where.id, status: initialStatus }),
      ),
      findMany: vi.fn(async () => [
        approvalFixture({ id: 'ap-1', status: initialStatus }),
      ]),
    },
    $transaction: vi.fn(async (cb: never) => cb(tx)),
  } as unknown as PrismaService;

  const service = new ApprovalsService(
    prisma,
    new RefundsService({} as unknown as PrismaService),
    new AuditService({} as unknown as PrismaService),
  );

  return {
    service,
    tx,
    prismaList: prisma.approvalRequest.findMany,
    events: () =>
      tx.auditLog.create.mock.calls.map(
        ([args]: [{ data: { event: string } }]) => args.data.event,
      ),
  };
}

describe('ApprovalsService', () => {
  it('list returns approvals filtered by status', async () => {
    const ctx = createContext();
    const result = await ctx.service.list('PENDING');

    expect(ctx.prismaList).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'PENDING' } }),
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('ap-1');
  });

  it('approve on PENDING creates refund, resolves ticket, writes both audits', async () => {
    const ctx = createContext();

    const result = await ctx.service.approve('ap-1', 'agent@example.com');

    expect(result.approval.status).toBe('APPROVED');
    expect(result.refund.status).toBe('COMPLETED');
    expect(result.ticket.status).toBe('RESOLVED');
    expect(ctx.tx.refund.create).toHaveBeenCalled();
    expect(ctx.tx.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'REFUNDED' }),
      }),
    );
    const events = ctx.events();
    expect(events).toContain('APPROVAL_APPROVED');
    expect(events).toContain('TICKET_RESOLVED');
  });

  it('approve on non-PENDING throws BadRequestException', async () => {
    const ctx = createContext('APPROVED');
    await expect(
      ctx.service.approve('ap-1', 'agent@example.com'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(ctx.tx.refund.create).not.toHaveBeenCalled();
  });

  it('approve on missing approval throws NotFoundException', async () => {
    const ctx = createContext();
    const prisma = ctx.service as unknown as {
      prisma: { approvalRequest: { findUnique: ReturnType<typeof vi.fn> } };
    };
    prisma.prisma.approvalRequest.findUnique.mockImplementationOnce(
      async () => null,
    );

    await expect(
      ctx.service.approve('missing', 'agent@example.com'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('reject on PENDING rejects approval, resolves ticket, writes both audits', async () => {
    const ctx = createContext();

    const result = await ctx.service.reject(
      'ap-1',
      'agent@example.com',
      'customer abusive',
    );

    expect(result.approval.status).toBe('REJECTED');
    expect(result.ticket.status).toBe('RESOLVED');
    expect(ctx.tx.refund.create).not.toHaveBeenCalled();
    const events = ctx.events();
    expect(events).toContain('APPROVAL_REJECTED');
    expect(events).toContain('TICKET_RESOLVED');
  });

  it('reject on non-PENDING throws BadRequestException', async () => {
    const ctx = createContext('REJECTED');
    await expect(
      ctx.service.reject('ap-1', 'agent@example.com'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
