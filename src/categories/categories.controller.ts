import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiBody, ApiParam } from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/categories.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/guards/roles.decorator';
import { UserRole } from '@generated/prisma';

@ApiTags('Categories')
@Controller('api/v1/categories')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CategoriesController {
  constructor(private categoriesService: CategoriesService) { }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create category (admin only)' })
  @ApiBody({
    type: CreateCategoryDto,
    examples: {
      default: {
        value: {
          name: 'Antibiotics',
          description: 'Medications used to treat bacterial infections',
        },
      },
      withParent: {
        value: {
          name: 'Penicillins',
          description: 'A group of antibiotics originally from Penicillium fungi',
          parentId: '550e8400-e29b-41d4-a716-446655440000',
        },
      },
    },
  })
  create(@Body() createCategoryDto: CreateCategoryDto) {
    return this.categoriesService.create(createCategoryDto);
  }

  @Get()
  @Roles(UserRole.PATIENT, UserRole.PHARMACY_OWNER, UserRole.PHARMACIST, UserRole.GOVERNMENT, UserRole.ADMIN)
  @ApiOperation({
    summary: 'List all categories',
    description: 'Endpoint: GET /api/v1/categories\n\nReturns a list of all categories in the system.',
  })
  findAll() {
    return this.categoriesService.findAll();
  }

  @Get(':id')
  @Roles(UserRole.PATIENT, UserRole.PHARMACY_OWNER, UserRole.PHARMACIST, UserRole.GOVERNMENT, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get category details',
    description: 'Endpoint: GET /api/v1/categories/:id\n\nURL Parameters:\n- id (UUID): The unique identifier of the category',
  })
  @ApiParam({ name: 'id', type: 'string', description: 'Category UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
  findOne(@Param('id') id: string) {
    return this.categoriesService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update category (admin only)',
    description: 'Endpoint: PATCH /api/v1/categories/:id\n\nURL Parameters:\n- id (UUID): The unique identifier of the category',
  })
  @ApiParam({ name: 'id', type: 'string', description: 'Category UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiBody({
    type: UpdateCategoryDto,
    examples: {
      partialUpdate: {
        value: {
          name: 'Broad-Spectrum Antibiotics',
        },
      },
      fullUpdate: {
        value: {
          name: 'Broad-Spectrum Antibiotics',
          description: 'Antibiotics active against a wide range of bacteria',
          parentId: null,
        },
      },
    },
  })
  update(@Param('id') id: string, @Body() updateCategoryDto: UpdateCategoryDto) {
    return this.categoriesService.update(id, updateCategoryDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Delete category (admin only)',
    description: 'Endpoint: DELETE /api/v1/categories/:id\n\nURL Parameters:\n- id (UUID): The unique identifier of the category to delete',
  })
  @ApiParam({ name: 'id', type: 'string', description: 'Category UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
  remove(@Param('id') id: string) {
    return this.categoriesService.remove(id);
  }
}
