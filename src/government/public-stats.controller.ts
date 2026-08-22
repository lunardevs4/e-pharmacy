import { Controller, Get } from '@nestjs/common';
import { GovernmentDashboardService } from './government-dashboard.service';
import { Public } from '../common/guards/public.decorator';

@Controller('api/v1/public')
export class PublicStatsController {
  constructor(private readonly governmentDashboardService: GovernmentDashboardService) {}

  @Public()
  @Get('stats')
  getStats() {
    return this.governmentDashboardService.getPublicStats();
  }
}
