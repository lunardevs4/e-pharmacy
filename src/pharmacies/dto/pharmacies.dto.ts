import { PartialType } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumberString, IsUUID, IsEnum } from 'class-validator';
import { PharmacyStatus, UserRole } from '@generated/prisma';

export class CreatePharmacyDto {
  @IsString()
  name: string;

  @IsString()
  address: string;

  @IsOptional()
  @IsNumberString()
  latitude?: string;

  @IsOptional()
  @IsNumberString()
  longitude?: string;

  @IsString()
  phone: string;

  @IsOptional()
  @IsString()
  licenseUrl?: string;

  @IsOptional()
  @IsString()
  licenseNumber?: string;

  @IsOptional()
  @IsString()
  province?: string;

  @IsOptional()
  @IsString()
  district?: string;

  @IsOptional()
  @IsString()
  managerName?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  ownershipType?: string;
}

export class UpdatePharmacyDto extends PartialType(CreatePharmacyDto) {}

export class AddEmployeeDto {
  @IsUUID()
  userId: string;

  @IsEnum(UserRole)
  role: UserRole;
}

export class ApprovePharmacyDto {
  @IsEnum(PharmacyStatus)
  status: PharmacyStatus;
}
