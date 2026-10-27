import {
  Controller,
  Get,
  Patch,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  UseGuards,
  Req,
  Body,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
} from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/guards/roles.decorator';
import { UserRole } from '@generated/prisma';

@ApiTags('Notifications')
@Controller('api/v1/notifications')
@UseGuards(JwtAuthGuard)
@Roles(
  UserRole.PATIENT,
  UserRole.PHARMACY_OWNER,
  UserRole.PHARMACIST,
  UserRole.GOVERNMENT,
  UserRole.ADMIN,
  UserRole.INSURANCE,
)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({
    summary: 'Get notifications for current scope',
    description:
      'Endpoint: GET /api/v1/notifications\nPatient/Govt → own only. Owner/Pharmacist → own + pharmacy scope. Admin → platform notifications.',
  })
  findAll(@Req() req: any) {
    return this.notificationsService.findAll(req.user);
  }

  @Get('email-preferences')
  getEmailPreferences(@Req() req: any) {
    return this.notificationsService.getEmailPreferences(req.user.id);
  }

  @Patch('email-preferences')
  updateEmailPreferences(
    @Req() req: any,
    @Body() body: Record<string, unknown>,
  ) {
    return this.notificationsService.updateEmailPreferences(req.user.id, body);
  }

  @Patch(':id/read')
  @ApiOperation({
    summary: 'Mark notification as read',
    description:
      'Endpoint: PATCH /api/v1/notifications/:id/read\n\nURL Parameters:\n- id (UUID): The unique identifier of the notification',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    description: 'Notification UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  markAsRead(@Param('id') id: string, @Req() req: any) {
    return this.notificationsService.markAsRead(req.user, id);
  }

  @Patch('read-all')
  @ApiOperation({
    summary: 'Mark all notifications as read in scope',
    description:
      'Endpoint: PATCH /api/v1/notifications/read-all\nMarks all notifications for the current role scope as read.',
  })
  markAllAsRead(@Req() req: any) {
    return this.notificationsService.markAllAsRead(req.user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete notification by ID',
    description:
      'Endpoint: DELETE /api/v1/notifications/:id\nDeletes a specific notification if owned by the user or within pharmacy/admin scope.',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    description: 'Notification UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  delete(@Param('id') id: string, @Req() req: any) {
    return this.notificationsService.delete(req.user, id);
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Clear all notifications for current user',
    description:
      'Endpoint: DELETE /api/v1/notifications\nDeletes all notifications for the authenticated user.',
  })
  deleteAll(@Req() req: any) {
    return this.notificationsService.deleteAll(req.user);
  }
}
