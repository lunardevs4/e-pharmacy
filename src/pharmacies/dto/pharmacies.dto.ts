import { PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumberString,
  IsUUID,
  IsEnum,
  IsBoolean,
  IsInt,
  IsIn,
  Min,
  Max,
} from 'class-validator';
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

export class UpdatePharmacySettingsDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000000)
  lowStockThreshold?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  expiryWarningDays?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(720)
  reservationDurationHours?: number;

  @IsOptional()
  @IsBoolean()
  autoExpireReservations?: boolean;

  @IsOptional()
  @IsString()
  @IsIn(['English', 'Français', 'Kinyarwanda'])
  language?: string;

  @IsOptional()
  @IsBoolean()
  twoFactorEnabled?: boolean;
}
