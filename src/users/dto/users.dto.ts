import { PartialType } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class CreateUserDto {
  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

export class UpdateUserDto extends PartialType(CreateUserDto) {}
