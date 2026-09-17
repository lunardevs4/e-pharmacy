import { IsString, IsOptional, IsNotEmpty, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class EnableMaintenanceDto {
  @ApiPropertyOptional({
    description: 'Optional maintenance message to display to users',
    example: 'Rwanda E-Pharmacy is temporarily undergoing scheduled maintenance.',
  })
  @IsString()
  @IsOptional()
  message?: string;

  @ApiPropertyOptional({
    description: 'Optional internal or public reason for maintenance',
    example: 'Database performance optimization and platform upgrade.',
  })
  @IsString()
  @IsOptional()
  reason?: string;

  @ApiPropertyOptional({
    description: 'Optional estimated end time in ISO date string format',
    example: '2026-09-20T04:00:00.000Z',
  })
  @IsDateString()
  @IsOptional()
  estimatedEndTime?: string;
}

export class DisableMaintenanceDto {
  @ApiPropertyOptional({
    description: 'Optional reason for disabling maintenance mode',
    example: 'Scheduled maintenance completed successfully.',
  })
  @IsString()
  @IsOptional()
  reason?: string;
}

export class ResumeNormalOperationDto extends DisableMaintenanceDto {}

export class EmergencyLockdownDto {
  @ApiProperty({
    description: 'Mandatory reason for triggering emergency lockdown',
    example: 'Investigating suspected security vulnerability or unexpected system behavior.',
  })
  @IsString()
  @IsNotEmpty({ message: 'A valid reason is required to trigger emergency lockdown.' })
  reason: string;
}

export class EmergencyUnlockDto {
  @ApiProperty({
    description: 'Mandatory reason for clearing emergency lockdown',
    example: 'Emergency investigation completed and system integrity verified.',
  })
  @IsString()
  @IsNotEmpty({ message: 'A valid reason is required to lift emergency lockdown.' })
  reason: string;
}

export class ScheduleMaintenanceDto {
  @ApiProperty({
    description: 'Scheduled maintenance start time in ISO-8601 format',
    example: '2026-09-20T02:00:00.000Z',
  })
  @IsDateString({}, { message: 'scheduledStart must be a valid ISO-8601 date string.' })
  @IsNotEmpty()
  scheduledStart: string;

  @ApiProperty({
    description: 'Scheduled maintenance end time in ISO-8601 format',
    example: '2026-09-20T04:00:00.000Z',
  })
  @IsDateString({}, { message: 'scheduledEnd must be a valid ISO-8601 date string.' })
  @IsNotEmpty()
  scheduledEnd: string;

  @ApiPropertyOptional({
    description: 'Optional maintenance message for scheduled window',
    example: 'Scheduled database optimization window.',
  })
  @IsString()
  @IsOptional()
  message?: string;
}
