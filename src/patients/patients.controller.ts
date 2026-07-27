import { Controller, Get, Post, Put, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiBody } from '@nestjs/swagger';
import { PatientsService } from './patients.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreatePatientDto, UpdatePatientDto } from './dto/patients.dto';

@ApiTags('Patients')
@Controller('api/v1/patients')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PatientsController {
  constructor(private patientsService: PatientsService) { }

  @Post('profile')
  @ApiOperation({
    summary: 'Create patient profile',
    description: 'Endpoint: POST /api/v1/patients/profile',
  })
  @ApiBody({
    type: CreatePatientDto,
    examples: {
      fullProfile: {
        value: {
          medicalProfile: 'Hypertension, Type 2 Diabetes. Allergic to Penicillin.',
          address: '123 Healthcare Street, Lagos, Nigeria',
          dateOfBirth: '1990-05-15',
          gender: 'Male',
        },
      },
      minimal: {
        value: {
          dateOfBirth: '1985-11-20',
          gender: 'Female',
        },
      },
    },
  })
  create(@Req() req: any, @Body() createPatientDto: CreatePatientDto) {
    return this.patientsService.create(req.user.id, createPatientDto);
  }

  @Get('profile')
  @ApiOperation({
    summary: 'Get patient profile',
    description: 'Endpoint: GET /api/v1/patients/profile\n\nReturns the profile of the currently authenticated patient.',
  })
  findOne(@Req() req: any) {
    return this.patientsService.findOne(req.user.id);
  }

  @Put('profile')
  @ApiOperation({
    summary: 'Update patient profile',
    description: 'Endpoint: PUT /api/v1/patients/profile',
  })
  @ApiBody({
    type: UpdatePatientDto,
    examples: {
      updateAddress: {
        value: {
          address: '456 Wellness Avenue, Abuja, Nigeria',
        },
      },
      updateMedical: {
        value: {
          medicalProfile: 'Updated: Hypertension well-controlled. Recent blood work normal.',
          address: '456 Wellness Avenue, Abuja, Nigeria',
          dateOfBirth: '1990-05-15',
          gender: 'Male',
        },
      },
    },
  })
  update(@Req() req: any, @Body() updatePatientDto: UpdatePatientDto) {
    return this.patientsService.update(req.user.id, updatePatientDto);
  }
}
