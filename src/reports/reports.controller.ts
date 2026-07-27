import { Controller, Get, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery, ApiParam } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/guards/roles.decorator';
import { UserRole } from '@generated/prisma';

@ApiTags('Reports')
@Controller('api/v1/reports')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ReportsController {
  constructor(private reportsService: ReportsService) { }

  @Get('pharmacy/:pharmacyId')
  @Roles(UserRole.PHARMACY_OWNER, UserRole.PHARMACIST, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Generate pharmacy report',
    description: 'Endpoint: GET /api/v1/reports/pharmacy/:pharmacyId?startDate=2025-01-01&endDate=2025-12-31\n\nURL Parameters:\n- pharmacyId (UUID): The unique identifier of the pharmacy\n\nQuery Parameters:\n- startDate (optional): Start date for the report period (YYYY-MM-DD)\n- endDate (optional): End date for the report period (YYYY-MM-DD)',
  })
  @ApiParam({ name: 'pharmacyId', type: 'string', description: 'Pharmacy UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiQuery({ name: 'startDate', required: false, example: '2025-01-01' })
  @ApiQuery({ name: 'endDate', required: false, example: '2025-12-31' })
  pharmacyReport(
    @Param('pharmacyId') pharmacyId: string,
    @Req() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.pharmacyReport(pharmacyId, req.user, startDate, endDate);
  }

  @Get('medicines')
  @Roles(UserRole.ADMIN, UserRole.PHARMACY_OWNER, UserRole.PHARMACIST)
  @ApiOperation({
    summary: 'Generate medicines report',
    description: 'Endpoint: GET /api/v1/reports/medicines?startDate=2025-01-01&endDate=2025-12-31\n\nQuery Parameters:\n- startDate (optional): Start date for the report period (YYYY-MM-DD)\n- endDate (optional): End date for the report period (YYYY-MM-DD)',
  })
  @ApiQuery({ name: 'startDate', required: false, example: '2025-01-01' })
  @ApiQuery({ name: 'endDate', required: false, example: '2025-12-31' })
  medicineReport(
    @Req() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.medicineReport(req.user, startDate, endDate);
  }

  @Get('patient/me')
  @Roles(UserRole.PATIENT)
  @ApiOperation({
    summary: 'Generate my personal patient report',
    description: 'Endpoint: GET /api/v1/reports/patient/me?startDate=2025-01-01&endDate=2025-12-31\n\nReturns personal reservation and prescription summary for the authenticated patient.',
  })
  @ApiQuery({ name: 'startDate', required: false, example: '2025-01-01' })
  @ApiQuery({ name: 'endDate', required: false, example: '2025-12-31' })
  patientReport(
    @Req() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.patientReport(req.user, startDate, endDate);
  }

  @Get('government')
  @Roles(UserRole.GOVERNMENT, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Generate national / government report',
    description: 'Endpoint: GET /api/v1/reports/government?startDate=2025-01-01&endDate=2025-12-31\n\nQuery Parameters:\n- startDate (optional): Start date for the report period (YYYY-MM-DD)\n- endDate (optional): End date for the report period (YYYY-MM-DD)',
  })
  @ApiQuery({ name: 'startDate', required: false, example: '2025-01-01' })
  @ApiQuery({ name: 'endDate', required: false, example: '2025-12-31' })
  governmentReport(
    @Req() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.governmentReport(req.user, startDate, endDate);
  }

  @Get('platform')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Generate platform-wide report (admin only)',
    description: 'Endpoint: GET /api/v1/reports/platform?startDate=2025-01-01&endDate=2025-12-31\n\nReturns comprehensive platform summary including system-wide metrics.',
  })
  @ApiQuery({ name: 'startDate', required: false, example: '2025-01-01' })
  @ApiQuery({ name: 'endDate', required: false, example: '2025-12-31' })
  platformReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.platformReport(startDate, endDate);
  }
}
