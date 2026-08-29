import { Controller, Get, Post, Body, Patch, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiBody, ApiParam } from '@nestjs/swagger';
import { RemindersService } from './reminders.service';
import { CreateReminderScheduleDto } from './dto/reminders.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/guards/roles.decorator';
import { UserRole } from '@generated/prisma';

@ApiTags('Medication Reminders')
@Controller('api/v1/reminders')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RemindersController {
  constructor(private remindersService: RemindersService) { }

  @Post('schedules')
  @Roles(UserRole.PATIENT)
  @ApiOperation({
    summary: 'Create reminder schedule (patient only)',
    description: 'Endpoint: POST /api/v1/reminders/schedules',
  })
  @ApiBody({
    type: CreateReminderScheduleDto,
    examples: {
      withPrescription: {
        value: {
          prescriptionId: '550e8400-e29b-41d4-a716-446655440000',
          medicineId: '550e8400-e29b-41d4-a716-446655440001',
          patientId: '550e8400-e29b-41d4-a716-446655440002',
          dosage: '500mg',
          startDate: '2025-07-25',
          endDate: '2025-08-08',
          timeOfDay: ['08:00', '14:00', '20:00'],
        },
      },
      withInterval: {
        value: {
          medicineId: '550e8400-e29b-41d4-a716-446655440002',
          dosage: '10mg',
          startDate: '2025-07-25',
          endDate: '2025-08-25',
          timeOfDay: ['08:00'],
          intervalHours: 24,
        },
      },
      twiceDaily: {
        value: {
          medicineId: '550e8400-e29b-41d4-a716-446655440003',
          dosage: '25mg',
          startDate: '2025-07-25',
          endDate: '2025-09-25',
          timeOfDay: ['09:00', '21:00'],
          intervalHours: 12,
        },
      },
    },
  })
  createSchedule(@Req() req: any, @Body() dto: CreateReminderScheduleDto) {
    return this.remindersService.createSchedule(req.user, dto);
  }

  @Get('schedules')
  @Roles(UserRole.PATIENT, UserRole.PHARMACY_OWNER, UserRole.PHARMACIST, UserRole.GOVERNMENT)
  @ApiOperation({
    summary: 'Get reminder schedules',
    description: 'Endpoint: GET /api/v1/reminders/schedules\n\nPatient → own schedules. Pharmacist/Owner → pharmacy scoped. Government → aggregated analytics view.',
  })
  getSchedules(@Req() req: any) {
    return this.remindersService.getSchedules(req.user);
  }

  @Patch('logs/:logId/complete')
  @Roles(UserRole.PATIENT)
  @ApiOperation({
    summary: 'Mark medication intake as completed (patient only)',
    description: 'Endpoint: PATCH /api/v1/reminders/logs/:logId/complete\n\nURL Parameters:\n- logId (UUID): The unique identifier of the reminder log to mark as completed',
  })
  @ApiParam({ name: 'logId', type: 'string', description: 'Reminder log UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
  markIntake(@Param('logId') logId: string, @Req() req: any) {
    return this.remindersService.markIntake(req.user, logId);
  }

  @Get('logs')
  @Roles(UserRole.PATIENT)
  @ApiOperation({
    summary: 'Get my reminder logs (patient only)',
    description: 'Endpoint: GET /api/v1/reminders/logs\n\nReturns all medication reminder logs (intake history) for the currently authenticated patient.',
  })
  getLogs(@Req() req: any) {
    return this.remindersService.getLogs(req.user);
  }
}
