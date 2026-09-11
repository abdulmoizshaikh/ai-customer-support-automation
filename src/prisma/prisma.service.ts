import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { envConfig } from '../common/config.js';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const adapter = new PrismaPg({
      connectionString: envConfig.databaseUrl,
    });
    super({ adapter });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    // Enable pgvector for environments where it is not yet created.
    await this.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS vector');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}