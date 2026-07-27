import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/categories.dto';
import { validateUuid, sanitizeDeep } from '../common/security/security.util';

@Injectable()
export class CategoriesService {
  constructor(private prismaService: PrismaService) { }

  create(createCategoryDto: CreateCategoryDto) {
    const prisma = this.prismaService.prisma;
    const safeDto = sanitizeDeep(createCategoryDto);
    return prisma.category.create({ data: safeDto });
  }

  findAll() {
    const prisma = this.prismaService.prisma;
    return prisma.category.findMany({
      where: { isActive: true, deletedAt: null },
      include: { children: true },
    });
  }

  findOne(id: string) {
    const prisma = this.prismaService.prisma;
    const safeId = validateUuid(id, 'id');
    return prisma.category.findUnique({
      where: { id: safeId },
      include: { children: true, parent: true, medicines: true },
    });
  }

  async update(id: string, updateCategoryDto: UpdateCategoryDto) {
    const prisma = this.prismaService.prisma;
    const safeId = validateUuid(id, 'id');
    const safeDto = sanitizeDeep(updateCategoryDto);
    const category = await prisma.category.findUnique({ where: { id: safeId } });
    if (!category) throw new NotFoundException('Category not found');
    return prisma.category.update({ where: { id: safeId }, data: safeDto });
  }

  async remove(id: string) {
    const prisma = this.prismaService.prisma;
    const safeId = validateUuid(id, 'id');
    const category = await prisma.category.findUnique({ where: { id: safeId } });
    if (!category) throw new NotFoundException('Category not found');
    return prisma.category.update({ where: { id: safeId }, data: { deletedAt: new Date(), isActive: false } });
  }
}
