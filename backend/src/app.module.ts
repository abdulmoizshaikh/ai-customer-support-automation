import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { createObserveModule } from '@nestjs/observe';
import { throttlerConfig } from './common/throttle/throttler-config.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CustomersModule } from './customers/customers.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { RefundsModule } from './refunds/refunds.module.js';
import { UsersModule } from './users/users.module.js';
import { AiModule } from './ai/ai.module.js';
import { EmbeddingsModule } from './embeddings/embeddings.module.js';
import { RagModule } from './rag/rag.module.js';
import { DecisionModule } from './decision/decision.module.js';
import { AuditModule } from './audit/audit.module.js';
import { TicketModule } from './tickets/ticket.module.js';
import { ApprovalsModule } from './approvals/approvals.module.js';
import { AdminModule } from './admin/admin.module.js';
import { AnalyticsModule } from './analytics/analytics.module.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    // Distributed tracing, auto-correlated logs, request/job metrics, error
    // telemetry, alarms, and more — out of the box. Sign up at https://observe.nestjs.com
    ObserveModule.forRoot({
      appKey: process.env.OBSERVE_APP_KEY ?? 'YOUR_APP_KEY',
      appSecret: process.env.OBSERVE_APP_SECRET ?? 'YOUR_APP_SECRET',
      serviceId: process.env.SERVICE_ID ?? 'cats-app',
    }),
    PrismaModule,
    ThrottlerModule.forRoot(throttlerConfig),
    AuthModule,
    CustomersModule,
    OrdersModule,
    RefundsModule,
    UsersModule,
    AiModule,
    EmbeddingsModule,
    RagModule,
    DecisionModule,
    AuditModule,
    TicketModule,
    ApprovalsModule,
    AdminModule,
    AnalyticsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
