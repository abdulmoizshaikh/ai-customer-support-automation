import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { RefundsModule } from '../refunds/refunds.module.js';
import { ApprovalsController } from './approvals.controller.js';
import { ApprovalsService } from './approvals.service.js';

@Module({
  imports: [AuditModule, RefundsModule],
  controllers: [ApprovalsController],
  providers: [ApprovalsService],
})
export class ApprovalsModule {}
