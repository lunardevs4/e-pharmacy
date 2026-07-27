import { IsUUID, IsInt, Min, IsEnum, IsDateString } from 'class-validator';
import { ReservationStatus } from '@generated/prisma';
import { TransformToISODateTime } from '../../common/transformers/date.transformer';

export class CreateReservationDto {
  @IsUUID()
  pharmacyId: string;

  @IsUUID()
  medicineId: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsDateString()
  @TransformToISODateTime()
  expiresAt: string;
}

export class UpdateReservationStatusDto {
  @IsEnum(ReservationStatus)
  status: ReservationStatus;
}
