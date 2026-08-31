import { IsUUID, IsString, IsDateString, IsArray, IsOptional, IsInt, IsBoolean } from 'class-validator';
import { TransformToISODateTime } from '../../common/transformers/date.transformer';

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
  @IsOptional() @IsArray() @IsString({ each: true })
  times?: string[];
  @IsOptional() @IsDateString() @TransformToISODateTime()
  startDate?: string;
  @IsOptional() @IsDateString() @TransformToISODateTime()
  endDate?: string;
  @IsOptional() @IsBoolean()
  isActive?: boolean;
}
