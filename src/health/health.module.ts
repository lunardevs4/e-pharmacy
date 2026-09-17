import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { SystemModule } from '../system/system.module';
import { HealthController } from './health.controller';

@Module({
  imports: [PrismaModule, SystemModule],
  controllers: [HealthController],
})
export class HealthModule {}
