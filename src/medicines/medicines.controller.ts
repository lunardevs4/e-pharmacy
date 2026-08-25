import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { MedicinesService } from './medicines.service';
import { CreateMedicineDto, UpdateMedicineDto } from './dto/medicines.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/guards/roles.decorator';
import { Public } from '../common/guards/public.decorator';
import { UserRole } from '@generated/prisma';

@ApiTags('Medicines')
@Controller('api/v1/medicines')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MedicinesController {
  constructor(private medicinesService: MedicinesService) {}

  @Post()
  @Roles(UserRole.PATIENT, UserRole.PHARMACY_OWNER, UserRole.PHARMACY, UserRole.PHARMACIST, UserRole.INSURANCE, UserRole.GOVERNMENT, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Create medicine',
    description:
      'Endpoint: POST /api/v1/medicines\n\nCreates a new medicine record in the system. Requires authentication and appropriate user role.',
  })
  @ApiBody({
    type: CreateMedicineDto,
    examples: {
      fullDetails: {
        value: {
          tradeName: 'Amoxicillin 500mg Capsules',
          genericName: 'Amoxicillin',
          categoryId: '550e8400-e29b-41d4-a716-446655440000',
          manufacturerId: '550e8400-e29b-41d4-a716-446655440001',
          initialBatch: {
            lotNumber: 'LOT-001',
            batchNumber: 'BATCH-001',
            expiryDate: '2027-12-31',
            unitCost: 5,
            unitSellingPrice: 8,
            initialStock: 100,
          },
        },
      },
      minimal: {
        value: {
          tradeName: 'Paracetamol Tablets',
          categoryName: 'Analgesics',
          manufacturerName: 'Generic Manufacturer',
          initialBatch: {
            lotNumber: 'LOT-002',
            batchNumber: 'BATCH-002',
            expiryDate: '2027-12-31',
            unitCost: 1,
            unitSellingPrice: 2,
            initialStock: 100,
          },
        },
      },
    },
  })
  create(@Body() createMedicineDto: CreateMedicineDto) {
    return this.medicinesService.create(createMedicineDto);
  }

  @Get()
  @Roles(UserRole.PATIENT, UserRole.PHARMACY_OWNER, UserRole.PHARMACY, UserRole.PHARMACIST, UserRole.INSURANCE, UserRole.GOVERNMENT, UserRole.ADMIN)
  @ApiOperation({
    summary: 'List all medicines',
    description:
      'Endpoint: GET /api/v1/medicines?page=1&limit=10&includeArchived=false\n\nQuery Parameters:\n- page (optional): Page number for pagination\n- limit (optional): Items per page\n- includeArchived (optional): Return archived medicines when true',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiQuery({
    name: 'includeArchived',
    required: false,
    type: Boolean,
    example: false,
  })
  findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('includeArchived') includeArchived?: string,
    @Query('search') search?: string,
    @Query('category') category?: string,
  ) {
    const includeArchivedFlag =
      String(includeArchived).toLowerCase() === 'true';
    return this.medicinesService.findAll(
      page,
      limit,
      includeArchivedFlag,
      search,
      category,
    );
  }

  @Get(':id')
  @Roles(UserRole.PATIENT, UserRole.PHARMACY_OWNER, UserRole.PHARMACY, UserRole.PHARMACIST, UserRole.INSURANCE, UserRole.GOVERNMENT, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get medicine details',
    description:
      'Endpoint: GET /api/v1/medicines/:id\n\nURL Parameters:\n- id (UUID): The unique identifier of the medicine',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    description: 'Medicine UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  findOne(@Param('id') id: string) {
    return this.medicinesService.findOne(id);
  }

  @Public()
  @Get(':id/availability')
  @ApiOperation({
    summary: 'Get medicine availability across pharmacies',
    description: 'Endpoint: GET /api/v1/medicines/:id/availability\n\nReturns all pharmacies stocking the medicine with prices, quantities, distances, and insurance co-pay splits.\n\nURL Parameters:\n- id (UUID): The unique identifier of the medicine\n\nQuery Parameters:\n- latitude (optional): User latitude for distance calculation\n- longitude (optional): User longitude for distance calculation\n- radius (optional): Search radius in km (default: 5)\n- insuranceId (optional): Insurance provider ID for co-pay calculation',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    description: 'Medicine UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiQuery({ name: 'latitude', required: false, type: Number, example: -1.944 })
  @ApiQuery({ name: 'longitude', required: false, type: Number, example: 30.061 })
  @ApiQuery({ name: 'radius', required: false, type: Number, example: 5 })
  @ApiQuery({ name: 'insuranceId', required: false, type: 'string' })
  getAvailability(
    @Param('id') id: string,
    @Query('latitude') latitude?: number,
    @Query('longitude') longitude?: number,
    @Query('radius') radius?: number,
    @Query('insuranceId') insuranceId?: string,
  ) {
    return this.medicinesService.getAvailability(id, latitude, longitude, radius, insuranceId);
  }

  @Patch(':id')
  @Roles(UserRole.PATIENT, UserRole.PHARMACY_OWNER, UserRole.PHARMACY, UserRole.PHARMACIST, UserRole.INSURANCE, UserRole.GOVERNMENT, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Update medicine',
    description:
      'Endpoint: PATCH /api/v1/medicines/:id\n\nURL Parameters:\n- id (UUID): The unique identifier of the medicine',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    description: 'Medicine UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiBody({
    type: UpdateMedicineDto,
    examples: {
      updatePrice: {
        value: {
          description: 'Updated description with more details',
        },
      },
      fullUpdate: {
        value: {
          name: 'Amoxicillin 500mg Capsules (Pack of 12)',
          genericName: 'Amoxicillin Trihydrate',
          description: 'Broad-spectrum antibiotic for bacterial infections',
          categoryId: '550e8400-e29b-41d4-a716-446655440000',
          manufacturerId: '550e8400-e29b-41d4-a716-446655440001',
          dosageForm: 'Hard Capsule',
          strength: '500mg',
          imageUrl: 'https://example.com/amoxicillin-new.jpg',
        },
      },
    },
  })
  update(
    @Param('id') id: string,
    @Body() updateMedicineDto: UpdateMedicineDto,
  ) {
    return this.medicinesService.update(id, updateMedicineDto);
  }

  @Delete(':id')
  @Roles(UserRole.PATIENT, UserRole.PHARMACY_OWNER, UserRole.PHARMACY, UserRole.PHARMACIST, UserRole.INSURANCE, UserRole.GOVERNMENT, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Delete medicine',
    description:
      'Endpoint: DELETE /api/v1/medicines/:id\n\nURL Parameters:\n- id (UUID): The unique identifier of the medicine to delete',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    description: 'Medicine UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  remove(@Param('id') id: string) {
    return this.medicinesService.remove(id);
  }
}
