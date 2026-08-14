import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiBody, ApiParam, ApiQuery } from '@nestjs/swagger';
import { ManufacturersService } from './manufacturers.service';
import { CreateManufacturerDto, UpdateManufacturerDto } from './dto/manufacturers.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/guards/roles.decorator';
import { UserRole } from '@generated/prisma';

@ApiTags('Manufacturers')
@Controller('api/v1/manufacturers')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ManufacturersController {
  constructor(private manufacturersService: ManufacturersService) { }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create manufacturer (admin only)' })
  @ApiBody({
    type: CreateManufacturerDto,
    examples: {
      default: {
        value: {
          name: 'Pfizer Inc.',
          country: 'United States',
        },
      },
      minimal: {
        value: {
          name: 'GlaxoSmithKline',
        },
      },
    },
  })
  create(@Body() createManufacturerDto: CreateManufacturerDto) {
    return this.manufacturersService.create(createManufacturerDto);
  }

  @Get()
  @Roles(UserRole.PATIENT, UserRole.PHARMACY_OWNER, UserRole.PHARMACIST, UserRole.GOVERNMENT, UserRole.ADMIN)
  @ApiOperation({
    summary: 'List all manufacturers',
    description: 'Endpoint: GET /api/v1/manufacturers\n\nReturns a list of all manufacturers in the system.',
  })
  @ApiQuery({ name: 'search', required: false, type: String })
  findAll(@Query('search') search?: string) {
    return this.manufacturersService.findAll(search);
  }

  @Get(':id')
  @Roles(UserRole.PATIENT, UserRole.PHARMACY_OWNER, UserRole.PHARMACIST, UserRole.GOVERNMENT, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get manufacturer details',
    description: 'Endpoint: GET /api/v1/manufacturers/:id\n\nURL Parameters:\n- id (UUID): The unique identifier of the manufacturer',
  })
  @ApiParam({ name: 'id', type: 'string', description: 'Manufacturer UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
  findOne(@Param('id') id: string) {
    return this.manufacturersService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update manufacturer (admin only)',
    description: 'Endpoint: PATCH /api/v1/manufacturers/:id\n\nURL Parameters:\n- id (UUID): The unique identifier of the manufacturer',
  })
  @ApiParam({ name: 'id', type: 'string', description: 'Manufacturer UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiBody({
    type: UpdateManufacturerDto,
    examples: {
      partialUpdate: {
        value: {
          country: 'UK',
        },
      },
      fullUpdate: {
        value: {
          name: 'GSK plc',
          country: 'United Kingdom',
        },
      },
    },
  })
  update(@Param('id') id: string, @Body() updateManufacturerDto: UpdateManufacturerDto) {
    return this.manufacturersService.update(id, updateManufacturerDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Delete manufacturer (admin only)',
    description: 'Endpoint: DELETE /api/v1/manufacturers/:id\n\nURL Parameters:\n- id (UUID): The unique identifier of the manufacturer to delete',
  })
  @ApiParam({ name: 'id', type: 'string', description: 'Manufacturer UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
  remove(@Param('id') id: string) {
    return this.manufacturersService.remove(id);
  }
}
