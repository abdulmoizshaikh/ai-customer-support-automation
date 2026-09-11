import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module.js';
import { RagModule } from '../rag/rag.module.js';
import { DecisionModule } from '../decision/decision.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { RefundsModule } from '../refunds/refunds.module.js';
import { TicketService } from './ticket.service.js';
import { TicketController } from './ticket.controller.js';

@Module({
  imports: [AiModule, RagModule, DecisionModule, AuditModule, RefundsModule],
  controllers: [TicketController],
  providers: [TicketService],
  exports: [TicketService],
})
export class TicketModule {}
