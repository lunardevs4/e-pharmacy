import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateMedicineDto, UpdateMedicineDto } from './dto/medicines.dto';
import { validatePositiveInt, validateUuid, sanitizeDeep } from '../common/security/security.util';

@Injectable()
export class MedicinesService {
  constructor(private prismaService: PrismaService) { }

  create(createMedicineDto: CreateMedicineDto) {
    const prisma = this.prismaService.prisma;
    const safeDto = sanitizeDeep(createMedicineDto);
    return prisma.medicine.create({ data: safeDto });
  }

  findAll(page: number = 1, limit: number = 10, includeArchived = false) {
    const prisma = this.prismaService.prisma;
    const safePage = validatePositiveInt(page, 'page', 1);
    const safeLimit = validatePositiveInt(limit, 'limit', 10);
    const skip = (safePage - 1) * safeLimit;
    return prisma.medicine.findMany({
      skip,
      take: safeLimit,
      where: {
        deletedAt: null,
        ...(includeArchived ? {} : { isActive: true }),
      },
      include: { category: true, manufacturer: true },
    });
  }

  findOne(id: string) {
    const prisma = this.prismaService.prisma;
    const safeId = validateUuid(id, 'id');
    return prisma.medicine.findUnique({
      where: { id: safeId },
      include: { category: true, manufacturer: true },
    });
  }

  async update(id: string, updateMedicineDto: UpdateMedicineDto) {
    const prisma = this.prismaService.prisma;
    const safeId = validateUuid(id, 'id');
    const safeDto = sanitizeDeep(updateMedicineDto);
    const medicine = await prisma.medicine.findUnique({ where: { id: safeId } });
    if (!medicine) throw new NotFoundException('Medicine not found');
    return prisma.medicine.update({ where: { id: safeId }, data: safeDto });
  }

  async remove(id: string) {
    const prisma = this.prismaService.prisma;
    const safeId = validateUuid(id, 'id');
    const medicine = await prisma.medicine.findUnique({ where: { id: safeId } });
    if (!medicine) throw new NotFoundException('Medicine not found');
    return prisma.medicine.update({ where: { id: safeId }, data: { deletedAt: new Date(), isActive: false } });
  }
}
