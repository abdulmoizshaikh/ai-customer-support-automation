import { Injectable } from '@nestjs/common';
import { AuditActor } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

export type AuditActorInput = 'customer' | 'ai' | 'system' | 'agent';

/**
 * Audit sink: either the PrismaService itself or an interactive transaction
 * client (`tx`) so audit writes join the caller's transaction. Prisma 7 does
 * not export a public transaction client type, so the sink is untyped here.
 */
type AuditSink = {
  auditLog: {
    create: (args: {
      data: {
        ticketId: string;
        event: string;
        actor: AuditActor;
        actorId?: string | null;
        metadata?: unknown;
      };
    }) => Promise<unknown>;
  };
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    ticketId: string,
    event: string,
    actor: AuditActorInput,
    metadata: Record<string, unknown> = {},
    db: unknown = this.prisma,
  ): Promise<void> {
    const client = db as AuditSink;
    await client.auditLog.create({
      data: {
        ticketId,
        event,
        actor: this.toPrismaActor(actor),
        metadata,
      },
    });
  }

  private toPrismaActor(actor: AuditActorInput): AuditActor {
    switch (actor) {
      case 'ai':
        return AuditActor.AI;
      case 'system':
        return AuditActor.SYSTEM;
      case 'agent':
      case 'customer':
        return AuditActor.HUMAN;
    }
  }
}
