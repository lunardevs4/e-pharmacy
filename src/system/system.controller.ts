import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { SystemService } from './system.service';
import {
  EnableMaintenanceDto,
  EmergencyLockdownDto,
  ResumeNormalOperationDto,
} from './dto/system.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/guards/roles.decorator';
import { Public } from '../common/guards/public.decorator';
import { UserRole } from '@generated/prisma';

@ApiTags('System Security & Governance')
@Controller('api/v1')
export class SystemController {
  constructor(private readonly systemService: SystemService) {}

  @Public()
  @Get('public/system-status')
  @ApiOperation({ summary: 'Get current system status (Public)' })
  @ApiResponse({ status: 200, description: 'Current system maintenance status' })
  async getPublicStatus() {
    return this.systemService.getPublicStatus();
  }

  @Get('admin/system/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get detailed system status (Admin only)' })
  @ApiResponse({ status: 200, description: 'Detailed system status including maintenance metadata' })
  async getAdminStatus() {
    return this.systemService.getSystemStatus();
  }

  @Post('admin/system/maintenance')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Enable scheduled system maintenance (Admin only)' })
  @ApiResponse({ status: 200, description: 'Maintenance mode activated successfully' })
  async enableMaintenance(
    @Body() dto: EnableMaintenanceDto,
    @Req() req: any,
  ) {
    return this.systemService.enableMaintenance(dto, req.user);
  }

  @Post('admin/system/lockdown')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Trigger emergency kill-switch / lockdown (Admin only)' })
  @ApiResponse({ status: 200, description: 'Emergency lockdown activated successfully' })
  async enableEmergencyLockdown(
    @Body() dto: EmergencyLockdownDto,
    @Req() req: any,
  ) {
    return this.systemService.enableEmergencyLockdown(dto, req.user);
  }

  @Post('admin/system/resume')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Resume normal operations (Admin only)' })
  @ApiResponse({ status: 200, description: 'System returned to OPERATIONAL state' })
  async resumeNormalOperation(
    @Body() dto: ResumeNormalOperationDto,
    @Req() req: any,
  ) {
    return this.systemService.resumeNormalOperation(dto, req.user);
  }
}
