import { Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { SeedTestOrderDto } from './dto/seed-test-order.dto.js';

export interface SeededOrderResult {
  orderId: string;
  amount: number;
  deliveredAt: Date;
  status: OrderStatus;
}

/**
 * Admin-only helpers for verification workflows. `seedTestOrder` creates a
 * fresh AUTO_REFUND-eligible order (DELIVERED, low amount, within refund
 * window) so real-LLM / e2e runs always have an un-refunded order to use.
 */
@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async seedTestOrder(dto: SeedTestOrderDto): Promise<SeededOrderResult> {
    const amount = dto.amount ?? 75;
    const deliveredDaysAgo = dto.deliveredDaysAgo ?? 2;
    const customerEmail = dto.customerEmail ?? 'muhammad@example.com';

    const customer = await this.prisma.customer.findUnique({
      where: { email: customerEmail },
      select: { id: true },
    });
    if (!customer) {
      throw new NotFoundException(`Customer ${customerEmail} not found`);
    }

    const orderId = await this.nextOrderId();
    const deliveredAt = new Date(Date.now() - deliveredDaysAgo * 86_400_000);

    const order = await this.prisma.order.create({
      data: {
        id: orderId,
        customerId: customer.id,
        status: OrderStatus.DELIVERED,
        amount,
        currency: 'USD',
        deliveredAt,
        refundedAt: null,
      },
    });

    return {
      orderId: order.id,
      amount: Number(order.amount),
      deliveredAt: order.deliveredAt ?? deliveredAt,
      status: order.status,
    };
  }

  private async nextOrderId(): Promise<string> {
    // Seed order ids are numeric strings — keep test ids numeric and readable
    // by incrementing the max existing numeric id.
    const rows = await this.prisma.$queryRaw<Array<{ max_id: bigint }>>`
      SELECT COALESCE(MAX(id::bigint), 0) AS max_id
      FROM "Order"
      WHERE id ~ '^[0-9]+$'
    `;
    const maxId = Number(rows[0]?.max_id ?? 0);
    return String(maxId + 1);
  }
}
