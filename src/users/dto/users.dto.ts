import { PartialType } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateUserDto {
  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  insuranceProvider?: string;
}

export class UpdateUserStatusDto {
  @IsBoolean()
  isActive: boolean;
}

export class UpdateUserDto extends PartialType(CreateUserDto) { }
