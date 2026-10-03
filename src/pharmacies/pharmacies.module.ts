import { Module } from '@nestjs/common';
import { PharmaciesService } from './pharmacies.service';
import { PharmaciesController } from './pharmacies.controller';
import { PrismaModule } from '../common/prisma/prisma.module';
import { TenantModule } from '../common/security/tenant.module';

@Module({
  imports: [PrismaModule, TenantModule],
  controllers: [PharmaciesController],
  providers: [PharmaciesService],
  exports: [PharmaciesService],
})
export class PharmaciesModule {}

