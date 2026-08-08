import { Controller, Get, Query, UseGuards, Req, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AuditLogsService } from './audit-logs.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/guards/roles.decorator';
import { UserRole } from '@generated/prisma';

@ApiTags('Audit Logs')
@Controller('api/v1/audit-logs')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AuditLogsController {
  constructor(private auditLogsService: AuditLogsService) { }

  @Get()
  @Roles(UserRole.GOVERNMENT, UserRole.ADMIN)
  @ApiOperation({
    summary: 'View audit logs (admin/government limited)',
    description: 'Endpoint: GET /api/v1/audit-logs?page=1&limit=10&entityType=User&action=CREATE\n\nADMIN → Full access. GOVERNMENT → Limited access (read-only scoped). Patients/Owners/Pharmacists are denied via RolesGuard.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiQuery({ name: 'entityType', required: false, example: 'User' })
  @ApiQuery({ name: 'action', required: false, example: 'CREATE' })
  findAll(
    @Req() req: any,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('entityType') entityType?: string,
    @Query('action') action?: string,
  ) {
    return this.auditLogsService.findAll(req.user, page, limit, entityType, action);
  }

  @Get('pharmacy/:pharmacyId')
  @Roles(UserRole.PHARMACY_OWNER, UserRole.PHARMACIST)
  @ApiOperation({ summary: 'View audit logs for an authorized pharmacy' })
  findByPharmacy(@Req() req: any, @Param('pharmacyId') pharmacyId: string, @Query('limit') limit?: number) {
    return this.auditLogsService.findByPharmacy(req.user, pharmacyId, limit);
  }
}
