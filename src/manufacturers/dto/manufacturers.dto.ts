import { PartialType } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CreateManufacturerDto {
  @IsString()
  @MinLength(1)
  name: string;
}

export class UpdateManufacturerDto extends PartialType(CreateManufacturerDto) {}
