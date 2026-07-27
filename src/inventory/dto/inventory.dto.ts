import { PartialType } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, IsUUID, IsDateString, IsString, Min } from 'class-validator';
import { TransformToISODateTimeOptional } from '../../common/transformers/date.transformer';

export class CreateInventoryDto {
  @IsUUID()
  medicineId: string;

  @IsInt()
  @Min(0)
  quantity: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  price: number;

  @IsOptional()
  @IsDateString()
  @TransformToISODateTimeOptional()
  expiryDate?: string;

  @IsOptional()
  @IsString()
  batchNumber?: string;
}

export class UpdateInventoryDto extends PartialType(CreateInventoryDto) {}
