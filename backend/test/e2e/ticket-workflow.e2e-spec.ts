import { Test, TestingModule } from '@nestjs/testing';
import { PrismaModule } from '../../src/prisma/prisma.module.js';
import { AiModule } from '../../src/ai/ai.module.js';
import { EmbeddingsModule } from '../../src/embeddings/embeddings.module.js';
import { RagModule } from '../../src/rag/rag.module.js';
import { DecisionModule } from '../../src/decision/decision.module.js';
import { AuditModule } from '../../src/audit/audit.module.js';
import { RefundsModule } from '../../src/refunds/refunds.module.js';
import { TicketModule } from '../../src/tickets/ticket.module.js';
import { ApprovalsModule } from '../../src/approvals/approvals.module.js';
import { TicketService } from '../../src/tickets/ticket.service.js';
import { ApprovalsService } from '../../src/approvals/approvals.service.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { TicketStatus } from '@prisma/client';

const SEED_ORDER_IDS = ['123', '124', '125', '456', '789'];

describe('Ticket workflow (e2e, real PostgreSQL + mock providers)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let tickets: TicketService;
  let approvals: ApprovalsService;
  let customerId: string;

  const eventsFor = async (ticketId: string) => {
    const logs = await prisma.auditLog.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'asc' },
      select: { event: true },
    });
    return logs.map((l) => l.event);
  };

  // Wipe test data only. Seed customers, knowledge documents, and users are
  // left untouched; seed orders are returned to their DELIVERED state so each
  // scenario in this file is repeatable.
  const resetDatabase = async () => {
    await prisma.auditLog.deleteMany();
    await prisma.refund.deleteMany();
    await prisma.approvalRequest.deleteMany();
    await prisma.ticket.deleteMany();
    await prisma.order.deleteMany({
      where: { id: { notIn: SEED_ORDER_IDS } },
    });
    await prisma.order.updateMany({
      data: { status: 'DELIVERED', refundedAt: null },
    });
  };

  beforeAll(async () => {
    // Force local mock providers: e2e must be deterministic and never depend
    // on a live LLM/embedding endpoint (or whatever .env currently points to).
    process.env.AI_PROVIDER = 'mock';
    process.env.EMBEDDING_PROVIDER = 'mock';

    moduleRef = await Test.createTestingModule({
      imports: [
        PrismaModule,
        AiModule,
        EmbeddingsModule,
        RagModule,
        DecisionModule,
        AuditModule,
        RefundsModule,
        TicketModule,
        ApprovalsModule,
      ],
    }).compile();
    await moduleRef.init();

    prisma = moduleRef.get(PrismaService);
    tickets = moduleRef.get(TicketService);
    approvals = moduleRef.get(ApprovalsService);

    const customer = await prisma.customer.findFirst();
    if (!customer) throw new Error('Seed customer required for e2e tests');
    customerId = customer.id;
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await resetDatabase();
    await moduleRef.close();
  });

  it('auto-refunds a low-value damaged order', async () => {
    const result = await tickets.processTicket(
      'My order #124 arrived damaged. I want a refund.',
      customerId,
    );

    expect(result.error).toBeUndefined();
    expect(result.decision?.action).toBe('AUTO_REFUND');
    expect(result.ticket.status).toBe(TicketStatus.RESOLVED);
    expect(result.refund?.status).toBe('COMPLETED');
    expect(Number(result.refund?.amount)).toBe(100);
    expect(result.approval).toBeNull();

    const order = await prisma.order.findUnique({ where: { id: '124' } });
    expect(order?.status).toBe('REFUNDED');
    expect(order?.refundedAt).not.toBeNull();

    expect(await eventsFor(result.ticket.id)).toEqual([
      'TICKET_CREATED',
      'AI_CLASSIFICATION',
      'RAG_RETRIEVED',
      'ORDER_LOOKED_UP',
      'DECISION_MADE',
      'REFUND_CREATED',
      'ORDER_STATUS_TRANSITIONED',
      'RESPONSE_GENERATED',
      'TICKET_RESOLVED',
    ]);
  });

  it('requests human approval for a high-value damaged order', async () => {
    const result = await tickets.processTicket(
      'My order #123 arrived damaged. I want a refund.',
      customerId,
    );

    expect(result.error).toBeUndefined();
    expect(result.decision?.action).toBe('REQUEST_HUMAN_APPROVAL');
    expect(result.ticket.status).toBe(TicketStatus.WAITING_APPROVAL);
    expect(result.approval).not.toBeNull();
    expect(result.refund).toBeNull();

    const approval = await prisma.approvalRequest.findUnique({
      where: { id: result.approval!.id },
    });
    expect(approval?.status).toBe('PENDING');
    expect(Number(approval?.amount)).toBe(750);

    const order = await prisma.order.findUnique({ where: { id: '123' } });
    expect(order?.status).toBe('DELIVERED');

    // 6 required decision events, plus the response-generation closers that
    // always fire (RESPONSE_GENERATED, TICKET_RESOLVED) = 8 total. Never a
    // REFUND_CREATED — the decision was not auto-approved.
    expect(await eventsFor(result.ticket.id)).toEqual([
      'TICKET_CREATED',
      'AI_CLASSIFICATION',
      'RAG_RETRIEVED',
      'ORDER_LOOKED_UP',
      'DECISION_MADE',
      'APPROVAL_REQUESTED',
      'RESPONSE_GENERATED',
      'TICKET_RESOLVED',
    ]);
  });

  it('rejects a refund outside the refund window', async () => {
    const result = await tickets.processTicket(
      'My order #125 arrived damaged. I want a refund.',
      customerId,
    );

    expect(result.error).toBeUndefined();
    expect(result.decision?.action).toBe('REJECT_REFUND');
    expect(result.decision?.reason).toBe('OUTSIDE_REFUND_WINDOW');
    expect(result.ticket.status).toBe(TicketStatus.RESOLVED);
    expect(result.refund).toBeNull();
    expect(result.approval).toBeNull();

    const refundCount = await prisma.refund.count();
    const approvalCount = await prisma.approvalRequest.count();
    expect(refundCount).toBe(0);
    expect(approvalCount).toBe(0);
  });

  it('returns ORDER_NOT_FOUND for an unknown order', async () => {
    const result = await tickets.processTicket(
      'My order #99999 arrived damaged. I want a refund.',
      customerId,
    );

    expect(result.error).toBeUndefined();
    expect(result.decision?.action).toBe('ORDER_NOT_FOUND');
    expect(result.ticket.status).toBe(TicketStatus.RESOLVED);
    expect(result.refund).toBeNull();
    expect(result.approval).toBeNull();
  });

  it('issues the refund when a human approves the pending request', async () => {
    const submitted = await tickets.processTicket(
      'My order #123 arrived damaged. I want a refund.',
      customerId,
    );
    expect(submitted.decision?.action).toBe('REQUEST_HUMAN_APPROVAL');

    const approved = await approvals.approve(
      submitted.approval!.id,
      'agent@example.com',
    );
    expect(approved.approval.status).toBe('APPROVED');
    expect(Number(approved.refund.amount)).toBe(750);
    expect(approved.ticket.status).toBe(TicketStatus.RESOLVED);

    const order = await prisma.order.findUnique({ where: { id: '123' } });
    expect(order?.status).toBe('REFUNDED');

    const events = await eventsFor(submitted.ticket.id);
    expect(events).toContain('APPROVAL_APPROVED');
    expect(events).toContain('ORDER_STATUS_TRANSITIONED');
    expect(events[events.length - 1]).toBe('TICKET_RESOLVED');

    const ticketsOnOrder = await prisma.ticket.count({
      where: { orderId: '123' },
    });
    expect(ticketsOnOrder).toBe(1);
  });

  it('does not refund an order that already has a completed refund', async () => {
    const first = await tickets.processTicket(
      'My order #124 arrived damaged. I want a refund.',
      customerId,
    );
    expect(first.decision?.action).toBe('AUTO_REFUND');

    const second = await tickets.processTicket(
      'My order #124 arrived damaged. I want a refund.',
      customerId,
    );
    expect(second.decision?.action).toBe('REJECT_REFUND');
    expect(second.decision?.reason).toBe('ORDER_ALREADY_REFUNDED');
    expect(second.ticket.status).toBe(TicketStatus.RESOLVED);
    expect(second.refund).toBeNull();

    const refundsForOrder = await prisma.refund.count({
      where: { orderId: '124' },
    });
    expect(refundsForOrder).toBe(1);

    const order = await prisma.order.findUnique({ where: { id: '124' } });
    expect(order?.status).toBe('REFUNDED');
  });
});
