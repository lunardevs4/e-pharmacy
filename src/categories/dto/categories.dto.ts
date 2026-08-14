import { PartialType } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @MinLength(1)
  name: string;
}

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}
