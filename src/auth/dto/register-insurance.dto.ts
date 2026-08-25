import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterInsuranceDto {
  @ApiProperty({ example: 'Radiant Insurance Company' })
  @IsString()
  fullname: string;

  @ApiProperty({ example: 'claims@radiant.rw' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '+250788123456' })
  @IsString()
  phone: string;

  @ApiProperty({ example: 'Password123!' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ required: false, example: 'RAD' })
  @IsOptional()
  @IsString()
  code?: string;
}
