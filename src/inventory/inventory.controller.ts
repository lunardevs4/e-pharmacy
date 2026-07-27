import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiBody, ApiParam } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { CreateInventoryDto, UpdateInventoryDto } from './dto/inventory.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/guards/roles.decorator';
import { UserRole } from '@generated/prisma';

@ApiTags('Inventory')
@Controller('api/v1/pharmacies/:pharmacyId/inventory')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class InventoryController {
  constructor(private inventoryService: InventoryService) { }

  @Post()
  @Roles(UserRole.PHARMACIST)
  @ApiOperation({
    summary: 'Add medicine to inventory (pharmacist only)',
    description: 'Endpoint: POST /api/v1/pharmacies/:pharmacyId/inventory\n\nURL Parameters:\n- pharmacyId (UUID): The unique identifier of the pharmacy',
  })
  @ApiParam({ name: 'pharmacyId', type: 'string', description: 'Pharmacy UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiBody({
    type: CreateInventoryDto,
    examples: {
      withExpiry: {
        value: {
          medicineId: '550e8400-e29b-41d4-a716-446655440000',
          quantity: 100,
          price: 15.99,
          expiryDate: '2027-12-31',
          batchNumber: 'BATCH-2024-001',
        },
      },
      minimal: {
        value: {
          medicineId: '550e8400-e29b-41d4-a716-446655440001',
          quantity: 50,
          price: 9.50,
        },
      },
    },
  })
  create(@Param('pharmacyId') pharmacyId: string, @Req() req: any, @Body() createInventoryDto: CreateInventoryDto) {
    return this.inventoryService.create(pharmacyId, req.user, createInventoryDto);
  }

  @Get()
  @Roles(UserRole.PATIENT, UserRole.PHARMACY_OWNER, UserRole.PHARMACIST, UserRole.GOVERNMENT, UserRole.ADMIN)
  @ApiOperation({
    summary: 'List pharmacy inventory',
    description: 'Endpoint: GET /api/v1/pharmacies/:pharmacyId/inventory\n\nURL Parameters:\n- pharmacyId (UUID): The unique identifier of the pharmacy',
  })
  @ApiParam({ name: 'pharmacyId', type: 'string', description: 'Pharmacy UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
  findByPharmacy(@Param('pharmacyId') pharmacyId: string, @Req() req: any) {
    return this.inventoryService.findByPharmacy(pharmacyId, req.user);
  }

  @Get(':id')
  @Roles(UserRole.PATIENT, UserRole.PHARMACY_OWNER, UserRole.PHARMACIST, UserRole.GOVERNMENT, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get inventory item details',
    description: 'Endpoint: GET /api/v1/pharmacies/:pharmacyId/inventory/:id\n\nURL Parameters:\n- pharmacyId (UUID): The unique identifier of the pharmacy\n- id (UUID): The unique identifier of the inventory item',
  })
  @ApiParam({ name: 'pharmacyId', type: 'string', description: 'Pharmacy UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiParam({ name: 'id', type: 'string', description: 'Inventory item UUID', example: '550e8400-e29b-41d4-a716-446655440001' })
  findOne(@Param('id') id: string, @Param('pharmacyId') pharmacyId: string, @Req() req: any) {
    return this.inventoryService.findOne(id, pharmacyId, req.user);
  }

  @Patch(':id')
  @Roles(UserRole.PHARMACIST)
  @ApiOperation({
    summary: 'Update inventory item (pharmacist only)',
    description: 'Endpoint: PATCH /api/v1/pharmacies/:pharmacyId/inventory/:id\n\nURL Parameters:\n- pharmacyId (UUID): The unique identifier of the pharmacy\n- id (UUID): The unique identifier of the inventory item',
  })
  @ApiParam({ name: 'pharmacyId', type: 'string', description: 'Pharmacy UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiParam({ name: 'id', type: 'string', description: 'Inventory item UUID', example: '550e8400-e29b-41d4-a716-446655440001' })
  @ApiBody({
    type: UpdateInventoryDto,
    examples: {
      updateQuantity: {
        value: {
          quantity: 150,
        },
      },
      updatePrice: {
        value: {
          price: 12.99,
        },
      },
      fullUpdate: {
        value: {
          medicineId: '550e8400-e29b-41d4-a716-446655440000',
          quantity: 200,
          price: 14.99,
          expiryDate: '2028-06-30',
          batchNumber: 'BATCH-2025-002',
        },
      },
    },
  })
  update(@Param('id') id: string, @Param('pharmacyId') pharmacyId: string, @Req() req: any, @Body() updateInventoryDto: UpdateInventoryDto) {
    return this.inventoryService.update(id, pharmacyId, req.user, updateInventoryDto);
  }

  @Delete(':id')
  @Roles(UserRole.PHARMACIST)
  @ApiOperation({
    summary: 'Remove inventory item (pharmacist only)',
    description: 'Endpoint: DELETE /api/v1/pharmacies/:pharmacyId/inventory/:id\n\nURL Parameters:\n- pharmacyId (UUID): The unique identifier of the pharmacy\n- id (UUID): The unique identifier of the inventory item to remove',
  })
  @ApiParam({ name: 'pharmacyId', type: 'string', description: 'Pharmacy UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiParam({ name: 'id', type: 'string', description: 'Inventory item UUID', example: '550e8400-e29b-41d4-a716-446655440001' })
  remove(@Param('id') id: string, @Param('pharmacyId') pharmacyId: string, @Req() req: any) {
    return this.inventoryService.remove(id, pharmacyId, req.user);
  }
}
