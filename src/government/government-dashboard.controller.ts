import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { GovernmentDashboardService } from './government-dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/guards/roles.decorator';
import { UserRole } from '@generated/prisma';

@ApiTags('Government Dashboard')
@Controller('api/v1/government')
@UseGuards(JwtAuthGuard)
@Roles(UserRole.GOVERNMENT, UserRole.ADMIN)
@ApiBearerAuth()
export class GovernmentDashboardController {
  constructor(private governmentDashboardService: GovernmentDashboardService) { }

  @Get('summary')
  @ApiOperation({
    summary: 'Get national dashboard summary',
    description: 'Endpoint: GET /api/v1/government/summary\n\nReturns high-level national dashboard summary statistics including total pharmacies, medicines, active users, etc.',
  })
  getSummary() {
    return this.governmentDashboardService.getSummary();
  }

  @Get('medicine-availability')
  @ApiOperation({
    summary: 'Get national medicine availability',
    description: 'Endpoint: GET /api/v1/government/medicine-availability\n\nReturns medicine availability data across all approved pharmacies nationwide.',
  })
  getMedicineAvailability() {
    return this.governmentDashboardService.getMedicineAvailability();
  }

  @Get('low-stock')
  @ApiOperation({
    summary: 'Get low stock medicines',
    description: 'Endpoint: GET /api/v1/government/low-stock?threshold=10\n\nQuery Parameters:\n- threshold (optional): Minimum stock quantity threshold to flag as low stock',
  })
  @ApiQuery({ name: 'threshold', required: false, type: Number, example: 10 })
  getLowStockMedicines(@Query('threshold') threshold?: string) {
    return this.governmentDashboardService.getLowStockMedicines(
      threshold ? parseInt(threshold) : undefined,
    );
  }

  @Get('district-coverage')
  @ApiOperation({
    summary: 'Get approved pharmacy coverage by district',
    description: 'Returns active medicine coverage and reservation counts for approved pharmacies grouped by district.',
  })
  getDistrictCoverage() {
    return this.governmentDashboardService.getDistrictCoverage();
  }

  @Get('reservation-stats')
  @ApiOperation({
    summary: 'Get reservation statistics',
    description: 'Endpoint: GET /api/v1/government/reservation-stats\n\nReturns reservation statistics including counts by status, trends, and processing times.',
  })
  getReservationStats() {
    return this.governmentDashboardService.getReservationStats();
  }
}
