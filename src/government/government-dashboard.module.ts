import { Module } from '@nestjs/common';
import { GovernmentDashboardService } from './government-dashboard.service';
import { GovernmentDashboardController } from './government-dashboard.controller';
import { PublicStatsController } from './public-stats.controller';
import { PrismaModule } from '../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [GovernmentDashboardController, PublicStatsController],
  providers: [GovernmentDashboardService],
  exports: [GovernmentDashboardService],
})
export class GovernmentDashboardModule {}
