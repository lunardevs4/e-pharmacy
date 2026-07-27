import { PartialType } from '@nestjs/swagger';
import { IsString, IsOptional, IsDateString } from 'class-validator';
import { TransformToISODateTimeOptional } from '../../common/transformers/date.transformer';

export class CreatePatientDto {
  @IsOptional()
  @IsString()
  medicalProfile?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsDateString()
  @TransformToISODateTimeOptional()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  gender?: string;
}

export class UpdatePatientDto extends PartialType(CreatePatientDto) {}
