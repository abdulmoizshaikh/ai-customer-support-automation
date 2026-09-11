import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RefundStatus } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateRefundDto } from './dto/create-refund.dto.js';

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
    const existing = await this.findByTicketId(dto.ticketId);
    if (existing) {
      return existing;
    }

    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
    });
    if (!order) {
      throw new NotFoundException(`Order ${dto.orderId} not found`);
    }

    const amount = dto.amount ?? Number(order.amount);
    const reason = dto.reason ?? 'Automated refund';

    try {
      const refund = await this.prisma.refund.create({
        data: {
          ticketId: dto.ticketId,
          orderId: order.id,
          amount,
          currency: order.currency,
          reason,
          status: RefundStatus.COMPLETED,
        },
      });

      // Simulate the external provider having settled the refund.
      await this.prisma.order.update({
        where: { id: order.id },
        data: { status: 'REFUNDED' },
      });

      return refund;
    } catch (error) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new BadRequestException(
          `Referenced ticket or order does not exist (ticketId=${dto.ticketId}, orderId=${dto.orderId})`,
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
