import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ApprovalStatus, TicketStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { RefundsService } from '../refunds/refunds.service.js';

const VALID_STATUSES = [
  ApprovalStatus.PENDING,
  ApprovalStatus.APPROVED,
  ApprovalStatus.REJECTED,
];

@Injectable()
export class ApprovalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly refunds: RefundsService,
    private readonly audit: AuditService,
  ) {}

  list(status?: string) {
    if (
      status !== undefined &&
      !VALID_STATUSES.includes(status as ApprovalStatus)
    ) {
      throw new BadRequestException(`Invalid approval status: ${status}`);
    }
    return this.prisma.approvalRequest.findMany({
      where: status ? { status: status as ApprovalStatus } : undefined,
      include: { ticket: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async approve(id: string, approvedByEmail: string) {
    const approval = await this.prisma.approvalRequest.findUnique({
      where: { id },
    });
    if (!approval) {
      throw new NotFoundException(`Approval ${id} not found`);
    }
    if (approval.status !== ApprovalStatus.PENDING) {
      throw new BadRequestException('Approval already resolved');
    }

    return this.prisma.$transaction(async (tx) => {
      const decider = await tx.user.findUnique({
        where: { email: approvedByEmail },
      });
      const decidedById = decider?.id ?? null;

      const approved = await tx.approvalRequest.update({
        where: { id },
        data: {
          status: ApprovalStatus.APPROVED,
          decidedById,
          decidedAt: new Date(),
        },
      });

      const ticket = await tx.ticket.findUnique({
        where: { id: approval.ticketId },
      });
      if (!ticket) {
        throw new NotFoundException(`Ticket ${approval.ticketId} not found`);
      }
      const order = ticket.orderId
        ? await tx.order.findUnique({ where: { id: ticket.orderId } })
        : null;
      if (!order) {
        throw new NotFoundException(
          `Order ${ticket.orderId} not found for ticket ${ticket.id}`,
        );
      }
      const previousStatus = order.status;

      const refund = await this.refunds.createForTicket(
        approval.ticketId,
        order.id,
        Number(approval.amount),
        'Human-approved refund',
        tx,
      );

      const updatedTicket = await tx.ticket.update({
        where: { id: approval.ticketId },
        data: { status: TicketStatus.RESOLVED },
      });

      await this.audit.record(
        approval.ticketId,
        'APPROVAL_APPROVED',
        'agent',
        {
          approvedBy: approvedByEmail,
          refundId: refund.id,
          amount: Number(approval.amount),
        },
        tx,
      );
      await this.audit.record(
        approval.ticketId,
        'ORDER_STATUS_TRANSITIONED',
        'system',
        { orderId: order.id, from: previousStatus, to: 'REFUNDED' },
        tx,
      );
      await this.audit.record(
        approval.ticketId,
        'TICKET_RESOLVED',
        'system',
        { finalStatus: 'RESOLVED', via: 'human-approval' },
        tx,
      );

      return { approval: approved, refund, ticket: updatedTicket };
    });
  }

  async reject(id: string, rejectedByEmail: string, reason?: string) {
    const approval = await this.prisma.approvalRequest.findUnique({
      where: { id },
    });
    if (!approval) {
      throw new NotFoundException(`Approval ${id} not found`);
    }
    if (approval.status !== ApprovalStatus.PENDING) {
      throw new BadRequestException('Approval already resolved');
    }

    return this.prisma.$transaction(async (tx) => {
      const decider = await tx.user.findUnique({
        where: { email: rejectedByEmail },
      });
      const decidedById = decider?.id ?? null;

      const rejected = await tx.approvalRequest.update({
        where: { id },
        data: {
          status: ApprovalStatus.REJECTED,
          decidedById,
          decidedAt: new Date(),
        },
      });

      const updatedTicket = await tx.ticket.update({
        where: { id: approval.ticketId },
        data: { status: TicketStatus.RESOLVED },
      });

      await this.audit.record(
        approval.ticketId,
        'APPROVAL_REJECTED',
        'agent',
        { rejectedBy: rejectedByEmail, reason: reason ?? null },
        tx,
      );
      await this.audit.record(
        approval.ticketId,
        'TICKET_RESOLVED',
        'system',
        { finalStatus: 'RESOLVED', via: 'human-rejection' },
        tx,
      );

      return { approval: rejected, ticket: updatedTicket };
    });
  }
}
