import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ApprovalStatus,
  ApprovalType,
  Intent,
  Priority,
  TicketStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AiService } from '../ai/ai.service.js';
import { RagService } from '../rag/rag.service.js';
import { DecisionService } from '../decision/decision.service.js';
import { AuditService } from '../audit/audit.service.js';
import { RefundsService } from '../refunds/refunds.service.js';
import type { Decision } from '../decision/types.js';
import type { TicketClassification } from '../ai/types/ticket-classification.js';

export interface RefundResult {
  id: string;
  amount: unknown;
  status: string;
}

export interface ApprovalResult {
  id: string;
  reason: string;
  amount: unknown;
}

export interface TicketResult {
  id: string;
  status: string;
}

export interface ProcessResult {
  ticket: TicketResult;
  classification: TicketClassification | null;
  decision: Decision | null;
  refund: RefundResult | null;
  approval: ApprovalResult | null;
  response: string | null;
  error?: string;
}

@Injectable()
export class TicketService {
  private readonly logger = new Logger(TicketService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly rag: RagService,
    private readonly decisionService: DecisionService,
    private readonly audit: AuditService,
    private readonly refunds: RefundsService,
  ) {}

  async processTicket(
    message: string,
    customerId?: string,
  ): Promise<ProcessResult> {
    // === Phase 1: short transaction, no external calls ===
    // Create ticket (OPEN) and audit TICKET_CREATED atomically.
    const ticket = await this.prisma.$transaction(async (tx) => {
      const created = await tx.ticket.create({
        data: { message, customerId, status: TicketStatus.OPEN },
      });
      await this.audit.record(
        created.id,
        'TICKET_CREATED',
        'customer',
        { messagePreview: message.slice(0, 80) },
        tx,
      );
      return created;
    });

    try {
      return await this.classifyAndResolve(ticket.id, message);
    } catch (error) {
      // Failure path: mark ticket FAILED in its own short tx, then return
      // the failure in the result (same contract as before the restructure).
      return this.markFailed(ticket.id, error);
    }
  }

  /**
   * Recovery path for FAILED tickets (Phase 9). Idempotent by ticketId:
   * refunds/approvals are unique per ticket, and Phase 3 only re-creates a
   * side effect if it does not already exist.
   */
  async retryFailedTicket(ticketId: string): Promise<ProcessResult> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { refund: true, approvalRequest: true },
    });
    if (!ticket) {
      throw new NotFoundException(`Ticket ${ticketId} not found`);
    }
    if (ticket.status !== TicketStatus.FAILED) {
      throw new BadRequestException('Ticket is not FAILED');
    }

    // No intent recorded -> Phase 2 (classification) never completed; re-run
    // classification onward. Otherwise Phase 4/5 failed and any side effects
    // are already committed; resume from response generation.
    const phaseTwoFailed = !ticket.intent;

    try {
      const result = phaseTwoFailed
        ? await this.classifyAndResolve(ticketId, ticket.message)
        : await this.resumeAfterResolution(ticket);

      await this.prisma.$transaction(async (tx) => {
        await tx.ticket.update({
          where: { id: ticketId },
          data: { status: result.ticket.status as TicketStatus },
        });
        await this.audit.record(
          ticketId,
          'TICKET_RETRY_SUCCEEDED',
          'system',
          { via: 'retry', fromStatus: 'FAILED' },
          tx,
        );
      });

      return result;
    } catch (error) {
      this.logger.error(`Ticket ${ticketId} retry failed`, error);
      await this.prisma.$transaction(async (tx) => {
        await this.audit.record(
          ticketId,
          'TICKET_RETRY_FAILED',
          'system',
          { error: error instanceof Error ? error.message : String(error) },
          tx,
        );
      });
      return {
        ticket: { id: ticketId, status: TicketStatus.FAILED },
        classification: null,
        decision: null,
        refund: null,
        approval: null,
        response: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // === Phases 2-5 shared by the initial workflow and the retry path ===

  private async classifyAndResolve(
    ticketId: string,
    message: string,
  ): Promise<ProcessResult> {
    // === Phase 2: no transaction, external calls + reads ===
    // LLM classification, RAG retrieval, order lookup, and the decision
    // must NOT hold a DB transaction open while blocking on external calls.
    const classification = await this.ai.classifyTicket(message);
    await this.prisma.$transaction(async (tx) => {
      await this.audit.record(
        ticketId,
        'AI_CLASSIFICATION',
        'ai',
        {
          intent: classification.intent,
          orderId: classification.orderId,
          priority: classification.priority,
          confidence: classification.confidence,
          provider: process.env.AI_PROVIDER ?? 'mock',
        },
        tx,
      );
    });

    const chunks = await this.rag.searchKnowledge(message, 3);
    await this.prisma.$transaction(async (tx) => {
      await this.audit.record(
        ticketId,
        'RAG_RETRIEVED',
        'system',
        {
          chunkCount: chunks.length,
          topScore: chunks[0]?.score ?? null,
          filenames: [...new Set(chunks.map((c) => c.filename))],
        },
        tx,
      );
    });

    const order = classification.orderId
      ? await this.prisma.order.findUnique({
          where: { id: classification.orderId },
          include: { refunds: { select: { status: true } } },
        })
      : null;
    await this.prisma.$transaction(async (tx) => {
      await this.audit.record(
        ticketId,
        'ORDER_LOOKED_UP',
        'system',
        {
          orderId: classification.orderId,
          found: !!order,
          amount: order ? Number(order.amount) : null,
          status: order?.status ?? null,
        },
        tx,
      );
    });

    const decision = this.decisionService.evaluate({
      intent: classification.intent,
      priority: classification.priority,
      confidence: classification.confidence,
      orderId: classification.orderId,
      order: order
        ? {
            id: order.id,
            amount: Number(order.amount),
            currency: order.currency,
            status: order.status.toLowerCase(),
            deliveredAt: order.deliveredAt,
            hasCompletedRefund: !!order.refunds?.some(
              (r) => r.status === 'COMPLETED',
            ),
          }
        : null,
    });

    // === Phase 3: ONE short transaction wrapping the write-side effects ===
    // Sub-second; no external calls in here.
    const sideEffects = await this.prisma.$transaction(async (tx) => {
      await this.audit.record(
        ticketId,
        'DECISION_MADE',
        'system',
        {
          action: decision.action,
          reason: decision.reason,
          amount: decision.amount,
          requiresApproval: decision.requiresApproval,
        },
        tx,
      );

      let refund: RefundResult | null = null;
      let approval: ApprovalResult | null = null;
      let finalStatus: TicketStatus = TicketStatus.RESOLVED;

      if (decision.action === 'AUTO_REFUND' && order) {
        refund = await this.refunds.createForTicket(
          ticketId,
          order.id,
          decision.amount ?? Number(order.amount),
          'Automated refund',
          tx,
        );
        await this.audit.record(
          ticketId,
          'REFUND_CREATED',
          'system',
          {
            refundId: refund.id,
            amount: Number(refund.amount),
            status: refund.status,
          },
          tx,
        );
        await this.audit.record(
          ticketId,
          'ORDER_STATUS_TRANSITIONED',
          'system',
          {
            orderId: order.id,
            from: order.status,
            to: 'REFUNDED',
          },
          tx,
        );
      } else if (
        decision.action === 'REQUEST_HUMAN_APPROVAL' ||
        decision.action === 'NEEDS_HUMAN_REVIEW'
      ) {
        approval = await tx.approvalRequest.create({
          data: {
            ticketId,
            type: ApprovalType.REFUND,
            amount: decision.amount,
            reason: decision.reason,
            status: ApprovalStatus.PENDING,
          },
        });
        await this.audit.record(
          ticketId,
          'APPROVAL_REQUESTED',
          'system',
          {
            approvalId: approval.id,
            reason: approval.reason,
            amount: Number(approval.amount),
          },
          tx,
        );
        finalStatus = TicketStatus.WAITING_APPROVAL;
      }

      const updated = await tx.ticket.update({
        where: { id: ticketId },
        data: {
          intent: this.toIntent(classification.intent),
          priority: this.toPriority(classification.priority),
          confidence: classification.confidence,
          orderId: order?.id ?? null,
          status: finalStatus,
        },
      });

      return { refund, approval, finalStatus, ticket: updated };
    });

    const finished = await this.finishResponse({
      ticketId,
      message,
      decision,
      order: order
        ? {
            id: order.id,
            amount: Number(order.amount),
            status: String(order.status),
          }
        : null,
      chunks,
      finalStatus: sideEffects.finalStatus,
    });

    return {
      ticket: finished.finalTicket,
      classification,
      decision,
      refund: sideEffects.refund,
      approval: sideEffects.approval,
      response: finished.response,
    };
  }

  /** Re-run Phase 4 (response generation) + Phase 5 (final writes) for a
   * FAILED ticket whose side effects are already committed. */
  private async resumeAfterResolution(ticket: {
    id: string;
    message: string;
    orderId: string | null;
    refund: {
      id: string;
      orderId: string;
      amount: unknown;
      status: string;
    } | null;
    approvalRequest: {
      id: string;
      reason: string;
      amount: unknown;
    } | null;
  }): Promise<ProcessResult> {
    const chunks = await this.rag.searchKnowledge(ticket.message, 3);
    const decision = await this.decisionFromAudit(ticket.id);

    const orderId = ticket.refund?.orderId ?? ticket.orderId;
    const order = orderId
      ? await this.prisma.order.findUnique({ where: { id: orderId } })
      : null;

    let refund: RefundResult | null = null;
    let approval: ApprovalResult | null = null;
    let finalStatus: TicketStatus = TicketStatus.RESOLVED;

    if (ticket.refund) {
      refund = {
        id: ticket.refund.id,
        amount: ticket.refund.amount,
        status: ticket.refund.status,
      };
    } else if (ticket.approvalRequest) {
      approval = {
        id: ticket.approvalRequest.id,
        reason: ticket.approvalRequest.reason,
        amount: ticket.approvalRequest.amount,
      };
      finalStatus = TicketStatus.WAITING_APPROVAL;
    }

    const finished = await this.finishResponse({
      ticketId: ticket.id,
      message: ticket.message,
      decision,
      order: order
        ? {
            id: order.id,
            amount: Number(order.amount),
            status: String(order.status),
          }
        : null,
      chunks,
      finalStatus,
    });

    return {
      ticket: finished.finalTicket,
      classification: null,
      decision,
      refund,
      approval,
      response: finished.response,
    };
  }

  /** Phase 4 + Phase 5: generate the customer response (no tx) then persist
   * it in a short transaction with the closing audits. */
  private async finishResponse(input: {
    ticketId: string;
    message: string;
    decision: Decision;
    order: { id: string; amount: number; status: string } | null;
    chunks: Array<{ filename: string; content: string }>;
    finalStatus: TicketStatus;
  }): Promise<{ finalTicket: TicketResult; response: string }> {
    const response = await this.ai.generateCustomerResponse({
      message: input.message,
      decision: {
        action: input.decision.action,
        amount: input.decision.amount,
        reason: input.decision.reason,
      },
      order: input.order
        ? {
            id: input.order.id,
            amount: Number(input.order.amount),
            status: input.order.status,
          }
        : null,
      policyChunks: input.chunks.map((c) => ({
        filename: c.filename,
        content: c.content,
      })),
    });

    const finalTicket = await this.prisma.$transaction(async (tx) => {
      await this.audit.record(
        input.ticketId,
        'RESPONSE_GENERATED',
        'ai',
        { action: input.decision.action, length: response.length },
        tx,
      );

      const updated = await tx.ticket.update({
        where: { id: input.ticketId },
        data: { aiResponse: response },
      });

      await this.audit.record(
        input.ticketId,
        'TICKET_RESOLVED',
        'system',
        { finalStatus: input.finalStatus },
        tx,
      );

      return updated;
    });

    return { finalTicket, response };
  }

  private async decisionFromAudit(ticketId: string): Promise<Decision> {
    const latest = await this.prisma.auditLog.findFirst({
      where: { ticketId, event: 'DECISION_MADE' },
      orderBy: { createdAt: 'desc' },
    });
    if (!latest) {
      throw new Error(`No DECISION_MADE audit recorded for ticket ${ticketId}`);
    }
    const meta = (latest.metadata ?? {}) as Record<string, unknown>;
    return {
      action: meta.action as Decision['action'],
      reason: meta.reason as Decision['reason'],
      amount:
        typeof meta.amount === 'number'
          ? meta.amount
          : meta.amount == null
            ? null
            : Number(meta.amount),
      requiresApproval: !!meta.requiresApproval,
      notes: [],
    };
  }

  private async markFailed(
    ticketId: string,
    error: unknown,
  ): Promise<ProcessResult> {
    this.logger.error(`Ticket ${ticketId} processing failed`, error);
    const failed = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.ticket.update({
        where: { id: ticketId },
        data: { status: TicketStatus.FAILED },
      });
      await this.audit.record(
        ticketId,
        'TICKET_FAILED',
        'system',
        { error: error instanceof Error ? error.message : String(error) },
        tx,
      );
      return updated;
    });
    return {
      ticket: failed,
      classification: null,
      decision: null,
      refund: null,
      approval: null,
      response: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  findById(id: string) {
    return this.prisma.ticket.findUnique({
      where: { id },
      include: {
        refund: true,
        approvalRequest: true,
        auditLogs: { orderBy: { createdAt: 'asc' } },
      },
    });
  }

  findAll() {
    return this.prisma.ticket.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        refund: true,
        approvalRequest: true,
        auditLogs: { orderBy: { createdAt: 'asc' } },
      },
    });
  }

  private toIntent(intent: TicketClassification['intent']): Intent {
    return intent.toUpperCase() as Intent;
  }

  private toPriority(priority: TicketClassification['priority']): Priority {
    return priority.toUpperCase() as Priority;
  }
}
