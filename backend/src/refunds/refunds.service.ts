import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RefundStatus } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateRefundDto } from './dto/create-refund.dto.js';

export interface RefundRecord {
  id: string;
  ticketId: string;
  orderId: string;
  amount: unknown;
  currency: string;
  status: string;
  reason: string;
}

/**
 * Fake refund provider. In a real system this would call a payment provider.
 * Refunds are idempotent: one ticket one refund (unique constraint on ticketId).
 */
@Injectable()
export class RefundsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Returns an existing refund for the ticket if one already exists. */
  async findByTicketId(ticketId: string) {
    return this.prisma.refund.findUnique({ where: { ticketId } });
  }

  async create(dto: CreateRefundDto) {
    return this.createForTicket(
      dto.ticketId,
      dto.orderId,
      dto.amount,
      dto.reason,
    );
  }

  /**
   * Programmatic refund for a ticket, optionally inside an interactive
   * transaction (`db` sink, mirroring AuditService). Once the refund reaches
   * COMPLETED the order is transitioned to REFUNDED with `refundedAt`.
   */
  async createForTicket(
    ticketId: string,
    orderId: string,
    amount?: number,
    reason?: string,
    db: unknown = this.prisma,
  ): Promise<RefundRecord> {
    const client = db as RefundDb;

    const existing = (await client.refund.findUnique({
      where: { ticketId },
    })) as RefundRecord | null;
    if (existing) {
      return existing;
    }

    const order = (await client.order.findUnique({
      where: { id: orderId },
    })) as {
      id: string;
      amount: { toString(): string } | number;
      currency: string;
    } | null;
    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    const finalAmount = amount ?? Number(order.amount);
    const finalReason = reason ?? 'Automated refund';

    try {
      const refund = (await client.refund.create({
        data: {
          ticketId,
          orderId: order.id,
          amount: finalAmount,
          currency: order.currency,
          reason: finalReason,
          status: RefundStatus.COMPLETED,
        },
      })) as RefundRecord;

      // Simulate the external provider having settled the refund.
      await client.order.update({
        where: { id: order.id },
        data: { status: 'REFUNDED', refundedAt: new Date() },
      });

      return refund;
    } catch (error) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new BadRequestException(
          `Referenced ticket or order does not exist (ticketId=${ticketId}, orderId=${orderId})`,
        );
      }
      throw error;
    }
  }

  findAll() {
    return this.prisma.refund.findMany({
      orderBy: { createdAt: 'desc' },
      include: { ticket: { select: { id: true, message: true } } },
    });
  }

  async findOne(id: string) {
    const refund = await this.prisma.refund.findUnique({
      where: { id },
      include: { ticket: true, order: true },
    });
    if (!refund) {
      throw new NotFoundException(`Refund ${id} not found`);
    }
    return refund;
  }
}

/**
 * Minimal refund sink: either the PrismaService itself or an interactive
 * transaction client (`tx`) so refund + order update join the caller's
 * transaction. Prisma 7 does not export a public transaction client type.
 */
type RefundDb = {
  refund: {
    findUnique: (args: { where: { ticketId: string } }) => Promise<unknown>;
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
  };
  order: {
    findUnique: (args: { where: { id: string } }) => Promise<unknown>;
    update: (args: {
      where: { id: string };
      data: { status: string; refundedAt: Date };
    }) => Promise<unknown>;
  };
};
