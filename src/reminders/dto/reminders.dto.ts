import {
  IsUUID,
  IsString,
  IsDateString,
  IsArray,
  IsOptional,
  IsInt,
  IsBoolean,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TransformToISODateTime } from '../../common/transformers/date.transformer';
import { NotificationType, ReminderStatus } from '@generated/prisma';

export class CreateReminderScheduleDto {
  @IsUUID()
  @IsOptional()
  patientId?: string;

  @IsOptional()
  @IsUUID()
  prescriptionId?: string;

  @IsUUID()
  @IsOptional()
  medicineId?: string;

  @IsOptional()
  @IsString()
  dosage?: string;

  @IsOptional()
  @IsDateString()
  @TransformToISODateTime()
  startDate: string;

  @IsOptional()
  @IsDateString()
  @TransformToISODateTime()
  endDate: string;

  @IsOptional()
  @IsArray()
  timeOfDay?: string[];

  @IsOptional()
  @IsInt()
  intervalHours?: number;

  @IsOptional()
  @IsEnum(NotificationType)
  channel?: NotificationType;

  @IsOptional()
  @IsString()
  medicineName?: string;

  @IsOptional()
  @IsArray()
  times?: string[];

  @IsOptional()
  @IsString()
  frequency?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  pharmacistInstructions?: string;
}

export class UpdateReminderScheduleDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  times?: string[];
  @IsOptional()
  @IsDateString()
  @TransformToISODateTime()
  startDate?: string;
  @IsOptional()
  @IsDateString()
  @TransformToISODateTime()
  endDate?: string;
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ReminderLogQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number = 20;

  @IsOptional()
  @IsEnum(ReminderStatus)
  status?: ReminderStatus;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsUUID()
  patientId?: string;
}

export class DeliveryStatusWebhookDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  providerMessageId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  networkCode?: string;

  @IsOptional()
  @IsString()
  failureReason?: string;

  @IsOptional()
  @IsString()
  error?: string;

  @IsOptional()
  retryCount?: number;
}

export class InboundSmsWebhookDto {
  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsString()
  id?: string;
}

