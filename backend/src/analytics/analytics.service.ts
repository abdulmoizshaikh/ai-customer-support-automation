import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export interface AnalyticsResult {
  tickets: {
    total: number;
    resolved: number;
    waitingApproval: number;
    failed: number;
    open: number;
  };
  automation: {
    automatedCount: number;
    escalatedCount: number;
    rejectedCount: number;
    automationRate: number;
  };
  approvals: {
    pending: number;
    approved: number;
    rejected: number;
  };
  refunds: {
    count: number;
    totalAmount: number;
    currency: string;
  };
  ai: {
    averageConfidence: number;
    providerCounts: Record<string, number>;
  };
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(): Promise<AnalyticsResult> {
    const [tickets, approvals, refunds, refundTotal, currencyRow] =
      await Promise.all([
        this.countTicketsByStatus(),
        this.countApprovalsByStatus(),
        this.prisma.refund.count(),
        this.sumRefundAmount(),
        this.prisma.refund.findFirst({
          select: { currency: true },
          orderBy: { createdAt: 'desc' },
        }),
      ]);

    const [automatedCount, rejectedCount, averageConfidence, providerRows] =
      await Promise.all([
        this.countDecisionAction('AUTO_REFUND'),
        this.countDecisionAction('REJECT_REFUND'),
        this.averageConfidence(),
        this.providerCounts(),
      ]);

    const total = tickets.total;
    const automated = automatedCount;
    const providerCounts: Record<string, number> = {};
    for (const row of providerRows) {
      if (row.provider) {
        providerCounts[row.provider] = Number(row.count);
      }
    }

    return {
      tickets,
      automation: {
        automatedCount: automated,
        escalatedCount:
          approvals.pending + approvals.approved + approvals.rejected,
        rejectedCount,
        automationRate:
          total > 0 ? Math.round((automated / total) * 10_000) / 10_000 : 0,
      },
      approvals,
      refunds: {
        count: refunds,
        totalAmount: refundTotal,
        currency: currencyRow?.currency ?? 'USD',
      },
      ai: {
        averageConfidence,
        providerCounts,
      },
    };
  }

  private async countTicketsByStatus() {
    const rows = await this.prisma.$queryRaw<
      Array<{ status: string; count: bigint }>
    >`
      SELECT status, COUNT(*)::bigint AS count
      FROM "Ticket"
      GROUP BY status
    `;
    const byStatus = new Map<string, number>();
    for (const row of rows) {
      byStatus.set(row.status, Number(row.count));
    }
    const opened = byStatus.get('OPEN') ?? 0;
    const resolved = byStatus.get('RESOLVED') ?? 0;
    const waitingApproval = byStatus.get('WAITING_APPROVAL') ?? 0;
    const failed = byStatus.get('FAILED') ?? 0;
    return {
      total: opened + resolved + waitingApproval + failed,
      resolved,
      waitingApproval,
      failed,
      open: opened,
    };
  }

  private async countApprovalsByStatus() {
    const rows = await this.prisma.$queryRaw<
      Array<{ status: string; count: bigint }>
    >`
      SELECT status, COUNT(*)::bigint AS count
      FROM "ApprovalRequest"
      GROUP BY status
    `;
    const byStatus = new Map<string, number>();
    for (const row of rows) {
      byStatus.set(row.status, Number(row.count));
    }
    return {
      pending: byStatus.get('PENDING') ?? 0,
      approved: byStatus.get('APPROVED') ?? 0,
      rejected: byStatus.get('REJECTED') ?? 0,
    };
  }

  private async sumRefundAmount(): Promise<number> {
    const rows = await this.prisma.$queryRaw<Array<{ total: unknown }>>`
      SELECT COALESCE(SUM(amount)::numeric, 0)::float8 AS total
      FROM "Refund"
    `;
    return Number(rows[0]?.total ?? 0);
  }

  private async countDecisionAction(action: string): Promise<number> {
    const rows = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM "AuditLog"
      WHERE event = 'DECISION_MADE' AND metadata->>'action' = ${action}
    `;
    return Number(rows[0]?.count ?? 0);
  }

  private async averageConfidence(): Promise<number> {
    const rows = await this.prisma.$queryRaw<Array<{ avg: unknown }>>`
      SELECT AVG((metadata->>'confidence')::float)::float8 AS avg
      FROM "AuditLog"
      WHERE event = 'AI_CLASSIFICATION'
        AND metadata->>'confidence' IS NOT NULL
    `;
    const avg = rows[0]?.avg;
    return typeof avg === 'number' && Number.isFinite(avg) ? avg : 0;
  }

  private async providerCounts(): Promise<
    Array<{ provider: string; count: bigint }>
  > {
    return this.prisma.$queryRaw<Array<{ provider: string; count: bigint }>>`
      SELECT metadata->>'provider' AS provider, COUNT(*)::bigint AS count
      FROM "AuditLog"
      WHERE event = 'AI_CLASSIFICATION' AND metadata->>'provider' IS NOT NULL
      GROUP BY metadata->>'provider'
    `;
  }
}
