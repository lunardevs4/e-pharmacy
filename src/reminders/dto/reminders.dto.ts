import { IsUUID, IsString, IsDateString, IsArray, IsOptional, IsInt } from 'class-validator';
import { TransformToISODateTime } from '../../common/transformers/date.transformer';

export class CreateReminderScheduleDto {
  @IsUUID()
  patientId: string;

  @IsOptional()
  @IsUUID()
  prescriptionId?: string;

  @IsUUID()
  medicineId: string;

  @IsString()
  dosage: string;

  @IsDateString()
  @TransformToISODateTime()
  startDate: string;

  @IsDateString()
  @TransformToISODateTime()
  endDate: string;

  @IsArray()
  timeOfDay: string[];

  @IsOptional()
  @IsInt()
  intervalHours?: number;
}
