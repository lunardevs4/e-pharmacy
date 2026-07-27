import { PartialType } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, IsArray, ValidateNested, IsEnum, IsInt } from 'class-validator';
import { Type } from 'class-transformer';
import { PrescriptionStatus } from '@generated/prisma';

export class PrescriptionMedicineDto {
  @IsUUID()
  medicineId: string;

  @IsString()
  dosage: string;

  @IsString()
  frequency: string;

  @IsString()
  duration: string;

  @IsInt()
  quantity: number;
}

export class CreatePrescriptionDto {
  @IsOptional()
  @IsString()
  documentUrl?: string;

  @IsOptional()
  @IsUUID()
  pharmacyId?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PrescriptionMedicineDto)
  medicines: PrescriptionMedicineDto[];
}

export class UpdatePrescriptionStatusDto {
  @IsEnum(PrescriptionStatus)
  status: PrescriptionStatus;
}
