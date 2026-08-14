import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/categories.dto';
import { validateUuid, sanitizeDeep } from '../common/security/security.util';

@Injectable()
export class CategoriesService {
  constructor(private prismaService: PrismaService) { }

  async create(createCategoryDto: CreateCategoryDto) {
    const prisma = this.prismaService.prisma;
    const safeDto = sanitizeDeep(createCategoryDto);
    try { return await prisma.category.create({ data: { name: safeDto.name.trim() } }); }
    catch (error) { if ((error as any)?.code === 'P2002') throw new ConflictException('Category name already exists'); throw error; }
  }

  findAll(search?: string) {
    const prisma = this.prismaService.prisma;
    return prisma.category.findMany({
      where: search ? { name: { contains: search.trim(), mode: 'insensitive' } } : {},
      orderBy: { name: 'asc' },
    });
  }

  findOne(id: string) {
    const prisma = this.prismaService.prisma;
    const safeId = validateUuid(id, 'id');
    return prisma.category.findUnique({
      where: { id: safeId },
      include: { medicines: true },
    });
  }

  async update(id: string, updateCategoryDto: UpdateCategoryDto) {
    const prisma = this.prismaService.prisma;
    const safeId = validateUuid(id, 'id');
    const safeDto = sanitizeDeep(updateCategoryDto);
    const category = await prisma.category.findUnique({ where: { id: safeId } });
    if (!category) throw new NotFoundException('Category not found');
    try { return await prisma.category.update({ where: { id: safeId }, data: { name: safeDto.name?.trim() } }); }
    catch (error) { if ((error as any)?.code === 'P2002') throw new ConflictException('Category name already exists'); throw error; }
  }

  async remove(id: string) {
    const prisma = this.prismaService.prisma;
    const safeId = validateUuid(id, 'id');
    const category = await prisma.category.findUnique({ where: { id: safeId } });
    if (!category) throw new NotFoundException('Category not found');
    return prisma.category.delete({ where: { id: safeId } });
  }
}
