import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsBoolean, IsEnum, IsDateString, IsArray, IsUUID, Min, Max, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export enum InsuranceStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
}

export enum ClaimStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  PAID = 'PAID',
}

export enum AgreementStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  TERMINATED = 'TERMINATED',
}

// Insurance Provider DTOs
export class CreateInsuranceProviderDto {
  @ApiProperty({ example: 'RSSB' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'RSSB' })
  @IsString()
  code: string;

  @ApiPropertyOptional({ example: 'https://rssb.rw/logo.png' })
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional({ example: 'insurance@rssb.rw' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ example: '+250788123456' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'Kigali, Rwanda' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: 85.00 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  defaultCoveragePercentage?: number;

  @ApiPropertyOptional({ example: 15.00 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  defaultCopayPercentage?: number;

  @ApiPropertyOptional({ enum: InsuranceStatus, default: InsuranceStatus.ACTIVE })
  @IsOptional()
  @IsEnum(InsuranceStatus)
  status?: InsuranceStatus;
}

export class UpdateInsuranceProviderDto {
  @ApiPropertyOptional({ example: 'RSSB Rwanda' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'https://rssb.rw/logo.png' })
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional({ example: 'insurance@rssb.rw' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ example: '+250788123456' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'Kigali, Rwanda' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: 85.00 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  defaultCoveragePercentage?: number;

  @ApiPropertyOptional({ example: 15.00 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  defaultCopayPercentage?: number;

  @ApiPropertyOptional({ enum: InsuranceStatus })
  @IsOptional()
  @IsEnum(InsuranceStatus)
  status?: InsuranceStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// Pharmacy Agreement DTOs
export class CreatePharmacyAgreementDto {
  @ApiProperty({ example: 'uuid-of-insurance' })
  @IsUUID()
  insuranceId: string;

  @ApiProperty({ example: 'uuid-of-pharmacy' })
  @IsUUID()
  pharmacyId: string;

  @ApiPropertyOptional({ example: 'AGR-2024-001' })
  @IsOptional()
  @IsString()
  contractNumber?: string;

  @ApiPropertyOptional({ example: 5.00 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discountRate?: number;

  @ApiPropertyOptional({ example: 90.00 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  customCoverageRate?: number;

  @ApiPropertyOptional({ example: '2024-01-01' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2025-12-31' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ enum: AgreementStatus, default: AgreementStatus.ACTIVE })
  @IsOptional()
  @IsEnum(AgreementStatus)
  status?: AgreementStatus;
}

export class UpdatePharmacyAgreementDto {
  @ApiPropertyOptional({ example: 'AGR-2024-001' })
  @IsOptional()
  @IsString()
  contractNumber?: string;

  @ApiPropertyOptional({ example: 5.00 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discountRate?: number;

  @ApiPropertyOptional({ example: 90.00 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  customCoverageRate?: number;

  @ApiPropertyOptional({ example: '2025-12-31' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ enum: AgreementStatus })
  @IsOptional()
  @IsEnum(AgreementStatus)
  status?: AgreementStatus;
}

// Medicine Tariff DTOs
export class SetMedicineTariffDto {
  @ApiProperty({ example: 'uuid-of-insurance' })
  @IsUUID()
  insuranceId: string;

  @ApiProperty({ example: 'uuid-of-medicine' })
  @IsUUID()
  medicineId: string;

  @ApiProperty({ example: 5000.00 })
  @IsNumber()
  @Min(0)
  coveredPrice: number;

  @ApiPropertyOptional({ example: 85.00 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  coveragePercentage?: number;

  @ApiPropertyOptional({ example: 15.00 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  copayPercentage?: number;

  @ApiPropertyOptional({ example: 500.00 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  fixedCopayAmount?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isCovered?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  requiresPreAuth?: boolean;

  @ApiPropertyOptional({ example: '2024-01-01' })
  @IsOptional()
  @IsDateString()
  effectiveDate?: string;
}

export class BatchUpdateTariffDto {
  @ApiProperty({ example: 'uuid-of-insurance' })
  @IsUUID()
  insuranceId: string;

  @ApiProperty({ type: [SetMedicineTariffDto] })
  @IsArray()
  @Type(() => SetMedicineTariffDto)
  tariffs: SetMedicineTariffDto[];
}

// Insurance Claim DTOs
export class CreateInsuranceClaimDto {
  @ApiProperty({ example: 'uuid-of-insurance' })
  @IsUUID()
  insuranceId: string;

  @ApiProperty({ example: 'uuid-of-pharmacy' })
  @IsUUID()
  pharmacyId: string;

  @ApiPropertyOptional({ example: 'uuid-of-insured-patient' })
  @IsOptional()
  @IsUUID()
  insuredPatientId?: string;

  @ApiPropertyOptional({ example: 'uuid-of-patient' })
  @IsOptional()
  @IsUUID()
  patientId?: string;

  @ApiProperty({ example: 'uuid-of-medicine' })
  @IsUUID()
  medicineId: string;

  @ApiPropertyOptional({ example: 'uuid-of-prescription' })
  @IsOptional()
  @IsUUID()
  prescriptionId?: string;

  @ApiPropertyOptional({ example: 'uuid-of-reservation' })
  @IsOptional()
  @IsUUID()
  reservationId?: string;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiProperty({ example: 5000.00 })
  @IsNumber()
  @Min(0)
  unitPrice: number;

  @ApiProperty({ example: 10000.00 })
  @IsNumber()
  @Min(0)
  totalAmount: number;

  @ApiProperty({ example: 8500.00 })
  @IsNumber()
  @Min(0)
  insuranceAmount: number;

  @ApiProperty({ example: 1500.00 })
  @IsNumber()
  @Min(0)
  patientAmount: number;

  @ApiPropertyOptional({ example: 'Urgent prescription' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateClaimStatusDto {
  @ApiProperty({ enum: ClaimStatus })
  @IsEnum(ClaimStatus)
  status: ClaimStatus;

  @ApiPropertyOptional({ example: 'Missing documentation' })
  @IsOptional()
  @IsString()
  rejectionReason?: string;
}

export class BatchPayClaimsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  claimIds: string[];
}

// Insured Patient DTOs
export class RegisterInsuredPatientDto {
  @ApiProperty({ example: 'uuid-of-insurance' })
  @IsUUID()
  insuranceId: string;

  @ApiPropertyOptional({ example: 'uuid-of-patient' })
  @IsOptional()
  @IsUUID()
  patientId?: string;

  @ApiProperty({ example: 'POL-2024-001234' })
  @IsString()
  policyNumber: string;

  @ApiPropertyOptional({ example: '119988007654' })
  @IsOptional()
  @IsString()
  nationalId?: string;

  @ApiProperty({ example: 'Jean Mugabo' })
  @IsString()
  fullName: string;

  @ApiPropertyOptional({ example: '1990-05-15' })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional({ example: 'Male' })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional({ example: '+250788123456' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 85.00 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  coveragePercentage?: number;

  @ApiPropertyOptional({ example: '2024-01-01' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2025-12-31' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ example: 'Marie Mugabo' })
  @IsOptional()
  @IsString()
  dependentName?: string;

  @ApiPropertyOptional({ example: 'Spouse' })
  @IsOptional()
  @IsString()
  dependentRelationship?: string;
}

export class VerifyPolicyDto {
  @ApiProperty({ example: 'POL-2024-001234' })
  @IsString()
  policyNumber: string;

  @ApiPropertyOptional({ example: '119988007654' })
  @IsOptional()
  @IsString()
  nationalId?: string;
}

// Dashboard Query DTOs
export class InsuranceDashboardQueryDto {
  @ApiPropertyOptional({ example: 'uuid-of-insurance' })
  @IsOptional()
  @IsUUID()
  insuranceId?: string;

  @ApiPropertyOptional({ example: '2024-01-01' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2024-12-31' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ enum: ClaimStatus })
  @IsOptional()
  @IsEnum(ClaimStatus)
  status?: ClaimStatus;

  @ApiPropertyOptional({ example: 'uuid-of-pharmacy' })
  @IsOptional()
  @IsUUID()
  pharmacyId?: string;
}
