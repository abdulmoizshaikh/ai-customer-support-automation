import { Injectable, Logger } from '@nestjs/common';
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
    const created = await this.prisma.ticket.create({
      data: { message, customerId, status: TicketStatus.OPEN },
    });

    try {
      return await this.prisma.$transaction(async (tx) => {
        const ticketId = created.id;

        await this.audit.record(
          ticketId,
          'TICKET_CREATED',
          'customer',
          { messagePreview: message.slice(0, 80) },
          tx,
        );

        const classification = await this.ai.classifyTicket(message);
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

        const chunks = await this.rag.searchKnowledge(message, 3);
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

        const order = classification.orderId
          ? await tx.order.findUnique({
              where: { id: classification.orderId },
              include: { refunds: { select: { status: true } } },
            })
          : null;
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

        const response = await this.ai.generateCustomerResponse({
          message,
          decision: {
            action: decision.action,
            amount: decision.amount,
            reason: decision.reason,
          },
          order: order
            ? {
                id: order.id,
                amount: Number(order.amount),
                status: order.status,
              }
            : null,
          policyChunks: chunks.map((c) => ({
            filename: c.filename,
            content: c.content,
          })),
        });
        await this.audit.record(
          ticketId,
          'RESPONSE_GENERATED',
          'ai',
          { action: decision.action, length: response.length },
          tx,
        );

        const updated = await tx.ticket.update({
          where: { id: ticketId },
          data: {
            intent: this.toIntent(classification.intent),
            priority: this.toPriority(classification.priority),
            confidence: classification.confidence,
            orderId: order?.id ?? null,
            status: finalStatus,
            aiResponse: response,
          },
        });
        await this.audit.record(
          ticketId,
          'TICKET_RESOLVED',
          'system',
          { finalStatus },
          tx,
        );

        return {
          ticket: updated,
          classification,
          decision,
          refund,
          approval,
          response,
        };
      });
    } catch (error) {
      this.logger.error(`Ticket ${created.id} processing failed`, error);
      const failed = await this.prisma.ticket.update({
        where: { id: created.id },
        data: { status: TicketStatus.FAILED },
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
