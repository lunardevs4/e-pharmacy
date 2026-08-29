import { IsUUID, IsString, IsDateString, IsArray, IsOptional, IsInt } from 'class-validator';
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

  // Patient reminder form fields. The service resolves the current patient
  // and medicine from these values when a patient creates a reminder.
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
