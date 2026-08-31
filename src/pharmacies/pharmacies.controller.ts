import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery, ApiBody, ApiParam } from '@nestjs/swagger';
import { PharmaciesService } from './pharmacies.service';
import { CreatePharmacyDto, UpdatePharmacyDto, AddEmployeeDto, ApprovePharmacyDto } from './dto/pharmacies.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/guards/roles.decorator';
import { PharmacyStatus, UserRole } from '@generated/prisma';
import { Public } from '../common/guards/public.decorator';

@ApiTags('Pharmacies')
@Controller('api/v1/pharmacies')
export class PharmaciesController {
  constructor(private pharmaciesService: PharmaciesService) { }

  @Post()
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.PHARMACY_OWNER)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Register a new pharmacy (pharmacy owner only)',
    description: 'Endpoint: POST /api/v1/pharmacies',
  })
  @ApiBody({
    type: CreatePharmacyDto,
    examples: {
      withCoordinates: {
        value: {
          name: 'HealthPlus Central Pharmacy',
          address: '123 Medical Plaza, Victoria Island, Lagos',
          latitude: '6.4281',
          longitude: '3.4214',
          phone: '+2341234567890',
          licenseUrl: '/uploads/licenses/pharmacy-license-001.pdf',
        },
      },
      minimal: {
        value: {
          name: 'Wellness Pharmacy',
          address: '45 Health Street, Abuja',
          phone: '+2348011122233',
        },
      },
    },
  })
  create(@Req() req: any, @Body() createPharmacyDto: CreatePharmacyDto) {
    return this.pharmaciesService.create(req.user.id, createPharmacyDto);
  }

  @Public()
  @Get()
  @ApiOperation({
    summary: 'List all pharmacies',
    description: 'Endpoint: GET /api/v1/pharmacies?page=1&limit=10&status=APPROVED\n\nQuery Parameters:\n- page (optional): Page number for pagination\n- limit (optional): Items per page\n- status (optional): Filter by pharmacy status (APPROVED, PENDING, REJECTED, SUSPENDED)',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiQuery({ name: 'status', required: false, enum: PharmacyStatus, example: PharmacyStatus.APPROVED })
  findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: PharmacyStatus,
  ) {
    return this.pharmaciesService.findAll(page, limit, status);
  }

  @Public()
  @Get(':id')
  @ApiOperation({
    summary: 'Get pharmacy details',
    description: 'Endpoint: GET /api/v1/pharmacies/:id\n\nURL Parameters:\n- id (UUID): The unique identifier of the pharmacy',
  })
  @ApiParam({ name: 'id', type: 'string', description: 'Pharmacy UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
  findOne(@Param('id') id: string) {
    return this.pharmaciesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.PHARMACY_OWNER)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update pharmacy (owner only)',
    description: 'Endpoint: PATCH /api/v1/pharmacies/:id\n\nURL Parameters:\n- id (UUID): The unique identifier of the pharmacy',
  })
  @ApiParam({ name: 'id', type: 'string', description: 'Pharmacy UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiBody({
    type: UpdatePharmacyDto,
    examples: {
      updatePhone: {
        value: {
          phone: '+2348077778888',
        },
      },
      fullUpdate: {
        value: {
          name: 'HealthPlus Central Pharmacy & Superstore',
          address: '123 Medical Plaza, Victoria Island, Lagos - Updated',
          latitude: '6.4281',
          longitude: '3.4214',
          phone: '+2348077778888',
          licenseUrl: '/uploads/licenses/pharmacy-license-updated.pdf',
        },
      },
    },
  })
  update(@Param('id') id: string, @Req() req: any, @Body() updatePharmacyDto: UpdatePharmacyDto) {
    return this.pharmaciesService.update(id, req.user.id, updatePharmacyDto);
  }

  @Patch(':id/approve')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.GOVERNMENT)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Approve/reject pharmacy (Government only)',
    description: 'Endpoint: PATCH /api/v1/pharmacies/:id/approve\n\nURL Parameters:\n- id (UUID): The unique identifier of the pharmacy',
  })
  @ApiParam({ name: 'id', type: 'string', description: 'Pharmacy UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiBody({
    type: ApprovePharmacyDto,
    examples: {
      approve: {
        value: {
          status: PharmacyStatus.APPROVED,
        },
      },
      reject: {
        value: {
          status: PharmacyStatus.REJECTED,
        },
      },
      pending: {
        value: {
          status: PharmacyStatus.PENDING,
        },
      },
    },
  })
  approve(@Param('id') id: string, @Body() approvePharmacyDto: ApprovePharmacyDto) {
    return this.pharmaciesService.approve(id, approvePharmacyDto);
  }

  @Post(':id/employees')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.PHARMACY_OWNER)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Add employee to pharmacy (owner only)',
    description: 'Endpoint: POST /api/v1/pharmacies/:id/employees\n\nURL Parameters:\n- id (UUID): The unique identifier of the pharmacy',
  })
  @ApiParam({ name: 'id', type: 'string', description: 'Pharmacy UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiBody({
    type: AddEmployeeDto,
    examples: {
      addPharmacist: {
        value: {
          userId: '550e8400-e29b-41d4-a716-446655440001',
          role: UserRole.PHARMACIST,
        },
      },
    },
  })
  addEmployee(@Param('id') id: string, @Req() req: any, @Body() addEmployeeDto: AddEmployeeDto) {
    return this.pharmaciesService.addEmployee(id, req.user.id, addEmployeeDto);
  }

  @Delete(':id/employees/:employeeId')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.PHARMACY_OWNER)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Remove employee from pharmacy (owner only)',
    description: 'Endpoint: DELETE /api/v1/pharmacies/:id/employees/:employeeId\n\nURL Parameters:\n- id (UUID): The unique identifier of the pharmacy\n- employeeId (UUID): The unique identifier of the pharmacy employee record to remove',
  })
  @ApiParam({ name: 'id', type: 'string', description: 'Pharmacy UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiParam({ name: 'employeeId', type: 'string', description: 'PharmacyEmployee record UUID', example: '550e8400-e29b-41d4-a716-446655440002' })
  removeEmployee(@Param('id') id: string, @Param('employeeId') employeeId: string, @Req() req: any) {
    return this.pharmaciesService.removeEmployee(id, req.user.id, employeeId);
  }


  @Get(':id/insurance')
  @Public()
  @ApiOperation({
    summary: 'Get insurance providers accepted by pharmacy',
    description: 'Returns all active insurance providers that the pharmacy has agreements with, including coverage information.',
  })
  @ApiParam({ name: 'id', type: 'string', description: 'Pharmacy UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
  getInsuranceProviders(@Param('id') id: string) {
    return this.pharmaciesService.getInsuranceProviders(id);
  }

  @Post(':id/insurance')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.PHARMACY_OWNER)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Add insurance provider to pharmacy (owner only)',
    description: 'Creates a new pharmacy-insurance agreement.',
  })
  @ApiParam({ name: 'id', type: 'string', description: 'Pharmacy UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        insuranceId: { type: 'string', description: 'Insurance provider UUID' },
        contractNumber: { type: 'string', description: 'Contract number' },
        discountRate: { type: 'number', description: 'Discount rate (0-100)', minimum: 0, maximum: 100 },
        customCoverageRate: { type: 'number', description: 'Custom coverage rate (0-100)', minimum: 0, maximum: 100 },
        startDate: { type: 'string', description: 'Agreement start date (ISO format)' },
        endDate: { type: 'string', description: 'Agreement end date (ISO format)' },
      },
      required: ['insuranceId'],
    },
  })
  addInsuranceProvider(
    @Param('id') id: string,
    @Req() req: any,
    @Body() data: {
      insuranceId: string;
      contractNumber?: string;
      discountRate?: number;
      customCoverageRate?: number;
      startDate?: string;
      endDate?: string;
    },
  ) {
    return this.pharmaciesService.addInsuranceProvider(id, req.user.id, data);
  }

  @Patch(':id/insurance/:agreementId')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.PHARMACY_OWNER)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update insurance agreement (owner only)',
    description: 'Updates an existing pharmacy-insurance agreement.',
  })
  @ApiParam({ name: 'id', type: 'string', description: 'Pharmacy UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiParam({ name: 'agreementId', type: 'string', description: 'Agreement UUID', example: '550e8400-e29b-41d4-a716-446655440001' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        contractNumber: { type: 'string' },
        discountRate: { type: 'number', minimum: 0, maximum: 100 },
        customCoverageRate: { type: 'number', minimum: 0, maximum: 100 },
        endDate: { type: 'string' },
        status: { type: 'string', enum: ['ACTIVE', 'SUSPENDED', 'TERMINATED'] },
      },
    },
  })
  updateInsuranceAgreement(
    @Param('id') id: string,
    @Param('agreementId') agreementId: string,
    @Req() req: any,
    @Body() data: {
      contractNumber?: string;
      discountRate?: number;
      customCoverageRate?: number;
      endDate?: string;
      status?: string;
    },
  ) {
    return this.pharmaciesService.updateInsuranceAgreement(id, req.user.id, agreementId, data);
  }

  @Delete(':id/insurance/:agreementId')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.PHARMACY_OWNER)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Remove insurance provider from pharmacy (owner only)',
    description: 'Terminates the pharmacy-insurance agreement.',
  })
  @ApiParam({ name: 'id', type: 'string', description: 'Pharmacy UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiParam({ name: 'agreementId', type: 'string', description: 'Agreement UUID', example: '550e8400-e29b-41d4-a716-446655440001' })
  removeInsuranceProvider(@Param('id') id: string, @Param('agreementId') agreementId: string, @Req() req: any) {
    return this.pharmaciesService.removeInsuranceProvider(id, req.user.id, agreementId);
  }
}
