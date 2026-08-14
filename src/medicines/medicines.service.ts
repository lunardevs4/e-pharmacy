import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateMedicineDto, UpdateMedicineDto } from './dto/medicines.dto';
import { validateDate, validatePositiveInt, validateUuid, sanitizeDeep } from '../common/security/security.util';

@Injectable()
export class MedicinesService {
  constructor(private prismaService: PrismaService) { }

  async create(createMedicineDto: CreateMedicineDto) {
    const prisma = this.prismaService.prisma;
    const safeDto = sanitizeDeep(createMedicineDto) as CreateMedicineDto;
    const categoryName = safeDto.categoryName?.trim();
    const manufacturerName = safeDto.manufacturerName?.trim();
    if (!safeDto.categoryId && !categoryName) throw new BadRequestException('categoryId or categoryName is required');
    if (!safeDto.manufacturerId && !manufacturerName) throw new BadRequestException('manufacturerId or manufacturerName is required');

    try {
      return await prisma.$transaction(async (tx) => {
        const category = safeDto.categoryId
          ? await tx.category.findUnique({ where: { id: validateUuid(safeDto.categoryId, 'categoryId') } })
          : await tx.category.upsert({ where: { name: categoryName! }, update: {}, create: { name: categoryName! } });
        if (!category) throw new NotFoundException('Category not found');

        const manufacturer = safeDto.manufacturerId
          ? await tx.manufacturer.findUnique({ where: { id: validateUuid(safeDto.manufacturerId, 'manufacturerId') } })
          : await tx.manufacturer.upsert({ where: { name: manufacturerName! }, update: {}, create: { name: manufacturerName! } });
        if (!manufacturer) throw new NotFoundException('Manufacturer not found');

        const batch = safeDto.initialBatch;
        const medicine = await tx.medicine.create({
          data: {
            tradeName: safeDto.tradeName,
            genericName: safeDto.genericName,
            categoryId: category.id,
            manufacturerId: manufacturer.id,
            batches: {
              create: {
                lotNumber: batch.lotNumber,
                batchNumber: batch.batchNumber,
                expiryDate: validateDate(batch.expiryDate, 'expiryDate')!,
                unitCost: batch.unitCost,
                unitSellingPrice: batch.unitSellingPrice,
                initialStock: batch.initialStock,
                currentStock: batch.initialStock,
                storageConditions: batch.storageConditions,
                minTemperature: batch.minTemperature,
                maxTemperature: batch.maxTemperature,
              },
            },
          },
          include: { category: true, manufacturer: true, batches: true },
        });
        return medicine;
      });
    } catch (error) {
      if ((error as any)?.code === 'P2002') {
        throw new ConflictException('A category, manufacturer, or batch with this name already exists');
      }
      throw error;
    }
  }

  findAll(page: number = 1, limit: number = 10, includeArchived = false) {
    const prisma = this.prismaService.prisma;
    const safePage = validatePositiveInt(page, 'page', 1);
    const safeLimit = validatePositiveInt(limit, 'limit', 10);
    const skip = (safePage - 1) * safeLimit;
    return prisma.medicine.findMany({
      skip,
      take: safeLimit,
      where: {},
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
    return prisma.medicine.delete({ where: { id: safeId } });
  }
}
