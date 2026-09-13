import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { MonitoringService } from '../monitoring/monitoring.service';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  public prisma: PrismaClient;

  constructor(private readonly monitoring: MonitoringService) {
    const connectionString = process.env.DATABASE_URL;
    const pool = new Pool({
      connectionString,
      max: 10,
      connectionTimeoutMillis: 15_000,
      idleTimeoutMillis: 30_000,
    });
    const adapter = new PrismaPg(pool);
    const client = new PrismaClient({ adapter });
    this.prisma = client.$extends({
      query: {
        $allOperations: async ({ operation, args, query }) => {
          const startedAt = process.hrtime.bigint();
          try {
            return await query(args);
          } finally {
            const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
            // Do not export SQL text or parameters: they may contain health data.
            this.monitoring.recordDatabaseQuery(operation, durationMs);
          }
        },
      },
    }) as unknown as PrismaClient;
  }

  async onModuleInit() {
    await this.prisma.$connect();
  }

  async onModuleDestroy() {
    await this.prisma.$disconnect();
  }
}
