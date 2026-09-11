import { Module } from '@nestjs/common';
import { createObserveModule } from '@nestjs/observe';
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

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    // Distributed tracing, auto-correlated logs, request/job metrics, error
    // telemetry, alarms, and more — out of the box. Sign up at https://observe.nestjs.com
    ObserveModule.forRoot({
      appKey: 'YOUR_APP_KEY',
      appSecret: 'YOUR_APP_SECRET',
      serviceId: 'backend',
    }),
    PrismaModule,
    AuthModule,
    CustomersModule,
    OrdersModule,
    RefundsModule,
    UsersModule,
    AiModule,
    EmbeddingsModule,
    RagModule,
    DecisionModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
