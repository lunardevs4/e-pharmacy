import { Controller, Get, Post, Body, Patch, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiBody, ApiParam } from '@nestjs/swagger';
import { PrescriptionsService } from './prescriptions.service';
import { CreatePrescriptionDto, UpdatePrescriptionStatusDto } from './dto/prescriptions.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/guards/roles.decorator';
import { UserRole, PrescriptionStatus } from '@generated/prisma';

@ApiTags('Prescriptions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Controller('api/v1')
export class PrescriptionsController {
  constructor(private prescriptionsService: PrescriptionsService) { }

  @Post('prescriptions')
  @Roles(UserRole.PATIENT)
  @ApiOperation({
    summary: 'Upload prescription (patient only)',
    description: 'Endpoint: POST /api/v1/prescriptions',
  })
  @ApiBody({
    type: CreatePrescriptionDto,
    examples: {
      withDocument: {
        value: {
          documentUrl: '/uploads/prescriptions/rx-2025-001.pdf',
          pharmacyId: '550e8400-e29b-41d4-a716-446655440000',
          notes: 'Please process as soon as possible.',
          medicines: [
            {
              medicineId: '550e8400-e29b-41d4-a716-446655440001',
              dosage: '500mg',
              frequency: '3 times daily',
              duration: '7 days',
              quantity: 21,
            },
            {
              medicineId: '550e8400-e29b-41d4-a716-446655440002',
              dosage: '10mg',
              frequency: 'Once daily',
              duration: '30 days',
              quantity: 30,
            },
          ],
        },
      },
      multipleMedicines: {
        value: {
          notes: 'Dr. Smith prescribed these.',
          medicines: [
            {
              medicineId: '550e8400-e29b-41d4-a716-446655440003',
              dosage: '250mg',
              frequency: 'Twice daily',
              duration: '10 days',
              quantity: 20,
            },
          ],
        },
      },
    },
  })
  create(@Req() req: any, @Body() createPrescriptionDto: CreatePrescriptionDto) {
    return this.prescriptionsService.create(req.user, createPrescriptionDto);
  }

  @Get('prescriptions')
  @Roles(UserRole.PATIENT)
  @ApiOperation({
    summary: 'View my prescriptions (patient only)',
    description: 'Endpoint: GET /api/v1/prescriptions\n\nReturns all prescriptions for the currently authenticated patient.',
  })
  findByPatient(@Req() req: any) {
    return this.prescriptionsService.findByPatient(req.user);
  }

  @Get('pharmacies/:pharmacyId/prescriptions')
  @Roles(UserRole.PHARMACY_OWNER, UserRole.PHARMACIST)
  @ApiOperation({
    summary: 'View pharmacy prescriptions',
    description: 'Endpoint: GET /api/v1/pharmacies/:pharmacyId/prescriptions\n\nURL Parameters:\n- pharmacyId (UUID): The unique identifier of the pharmacy',
  })
  @ApiParam({ name: 'pharmacyId', type: 'string', description: 'Pharmacy UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
  findByPharmacy(@Param('pharmacyId') pharmacyId: string, @Req() req: any) {
    return this.prescriptionsService.findByPharmacy(pharmacyId, req.user);
  }

  @Patch('pharmacies/:pharmacyId/prescriptions/:id')
  @Roles(UserRole.PHARMACIST)
  @ApiOperation({
    summary: 'Approve/reject prescription (pharmacist only)',
    description: 'Endpoint: PATCH /api/v1/pharmacies/:pharmacyId/prescriptions/:id\n\nURL Parameters:\n- pharmacyId (UUID): The unique identifier of the pharmacy\n- id (UUID): The unique identifier of the prescription',
  })
  @ApiParam({ name: 'pharmacyId', type: 'string', description: 'Pharmacy UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiParam({ name: 'id', type: 'string', description: 'Prescription UUID', example: '550e8400-e29b-41d4-a716-446655440001' })
  @ApiBody({
    type: UpdatePrescriptionStatusDto,
    examples: {
      approve: {
        value: {
          status: PrescriptionStatus.APPROVED,
        },
      },
      reject: {
        value: {
          status: PrescriptionStatus.REJECTED,
        },
      },
      pending: {
        value: {
          status: PrescriptionStatus.PENDING,
        },
      },
    },
  })
  updateStatus(
    @Param('pharmacyId') pharmacyId: string,
    @Param('id') id: string,
    @Req() req: any,
    @Body() updateDto: UpdatePrescriptionStatusDto,
  ) {
    return this.prescriptionsService.updateStatus(pharmacyId, req.user, id, updateDto);
  }
}
