import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsString, IsOptional, IsUUID, IsBoolean, IsDateString, IsInt, IsNumber, Min, ValidateNested, ValidateIf } from 'class-validator';

export class CreateMedicineBatchDto {
  @IsString()
  lotNumber: string;

  @IsString()
  batchNumber: string;

  @IsDateString()
  expiryDate: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitCost: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitSellingPrice: number;

  @IsInt()
  @Min(0)
  initialStock: number;

  @IsOptional()
  @IsString()
  storageConditions?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  minTemperature?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  maxTemperature?: number;
}

export class CreateMedicineDto {
  @IsString()
  tradeName: string;

  @IsString()
  genericName: string;

  @ValidateIf((dto) => !dto.categoryName)
  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @ValidateIf((dto) => !dto.categoryId)
  @IsString()
  @IsOptional()
  categoryName?: string;

  @ValidateIf((dto) => !dto.manufacturerName)
  @IsUUID()
  @IsOptional()
  manufacturerId?: string;

  @ValidateIf((dto) => !dto.manufacturerId)
  @IsString()
  @IsOptional()
  manufacturerName?: string;

  @ValidateNested()
  @Type(() => CreateMedicineBatchDto)
  initialBatch: CreateMedicineBatchDto;
}

export class UpdateMedicineDto extends PartialType(CreateMedicineDto) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
