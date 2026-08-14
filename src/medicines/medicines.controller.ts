import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery, ApiBody, ApiParam } from '@nestjs/swagger';
import { MedicinesService } from './medicines.service';
import { CreateMedicineDto, UpdateMedicineDto } from './dto/medicines.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/guards/roles.decorator';
import { UserRole } from '@generated/prisma';

@ApiTags('Medicines')
@Controller('api/v1/medicines')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MedicinesController {
  constructor(private medicinesService: MedicinesService) { }

  @Post()
  @Roles(UserRole.PHARMACIST, UserRole.PHARMACY_OWNER)
  @ApiOperation({ summary: 'Create medicine (Government, Pharmacist, Pharmacy Owner only)', description: 'Endpoint: POST /api/v1/medicines\n\nCreates a new medicine record in the system. Requires authentication and appropriate user role.' })
  @ApiBody({
    type: CreateMedicineDto,
    examples: {
      fullDetails: {
        value: {
          tradeName: 'Amoxicillin 500mg Capsules',
          genericName: 'Amoxicillin',
          categoryId: '550e8400-e29b-41d4-a716-446655440000',
          manufacturerId: '550e8400-e29b-41d4-a716-446655440001',
          initialBatch: { lotNumber: 'LOT-001', batchNumber: 'BATCH-001', expiryDate: '2027-12-31', unitCost: 5, unitSellingPrice: 8, initialStock: 100 },
        },
      },
      minimal: {
        value: {
          tradeName: 'Paracetamol Tablets',
          categoryName: 'Analgesics',
          manufacturerName: 'Generic Manufacturer',
          initialBatch: { lotNumber: 'LOT-002', batchNumber: 'BATCH-002', expiryDate: '2027-12-31', unitCost: 1, unitSellingPrice: 2, initialStock: 100 },
        },
      },
    },
  })
  create(@Body() createMedicineDto: CreateMedicineDto) {
    return this.medicinesService.create(createMedicineDto);
  }

  @Get()
  @Roles(UserRole.PATIENT, UserRole.PHARMACY_OWNER, UserRole.PHARMACIST, UserRole.GOVERNMENT)
  @ApiOperation({
    summary: 'List all medicines',
    description: 'Endpoint: GET /api/v1/medicines?page=1&limit=10&includeArchived=false\n\nQuery Parameters:\n- page (optional): Page number for pagination\n- limit (optional): Items per page\n- includeArchived (optional): Return archived medicines when true',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiQuery({ name: 'includeArchived', required: false, type: Boolean, example: false })
  findAll(@Query('page') page?: number, @Query('limit') limit?: number, @Query('includeArchived') includeArchived?: string) {
    const includeArchivedFlag = String(includeArchived).toLowerCase() === 'true';
    return this.medicinesService.findAll(page, limit, includeArchivedFlag);
  }

  @Get(':id')
  @Roles(UserRole.PATIENT, UserRole.PHARMACY_OWNER, UserRole.PHARMACIST, UserRole.GOVERNMENT)
  @ApiOperation({
    summary: 'Get medicine details',
    description: 'Endpoint: GET /api/v1/medicines/:id\n\nURL Parameters:\n- id (UUID): The unique identifier of the medicine',
  })
  @ApiParam({ name: 'id', type: 'string', description: 'Medicine UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
  findOne(@Param('id') id: string) {
    return this.medicinesService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.PHARMACIST, UserRole.PHARMACY_OWNER)
  @ApiOperation({
    summary: 'Update medicine (pharmacist and pharmacy_owner)',
    description: 'Endpoint: PATCH /api/v1/medicines/:id\n\nURL Parameters:\n- id (UUID): The unique identifier of the medicine',
  })
  @ApiParam({ name: 'id', type: 'string', description: 'Medicine UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
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
  update(@Param('id') id: string, @Body() updateMedicineDto: UpdateMedicineDto) {
    return this.medicinesService.update(id, updateMedicineDto);
  }

  @Delete(':id')
  @Roles(UserRole.PHARMACIST, UserRole.PHARMACY_OWNER)
  @ApiOperation({
    summary: 'Delete medicine (pharmacist and pharmacy_owner)',
    description: 'Endpoint: DELETE /api/v1/medicines/:id\n\nURL Parameters:\n- id (UUID): The unique identifier of the medicine to delete',
  })
  @ApiParam({ name: 'id', type: 'string', description: 'Medicine UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
  remove(@Param('id') id: string) {
    return this.medicinesService.remove(id);
  }
}
