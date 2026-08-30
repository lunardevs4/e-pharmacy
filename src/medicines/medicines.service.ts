import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateMedicineDto, UpdateMedicineDto } from './dto/medicines.dto';
import {
  validateDate,
  validatePositiveInt,
  validateUuid,
  sanitizeDeep,
  validateGeoCoordinate,
} from '../common/security/security.util';

@Injectable()
export class MedicinesService {
  constructor(private prismaService: PrismaService) {}

  async create(createMedicineDto: CreateMedicineDto) {
    const prisma = this.prismaService.prisma;
    const safeDto = sanitizeDeep(createMedicineDto) as CreateMedicineDto;
    const categoryName = safeDto.categoryName?.trim();
    const manufacturerName = safeDto.manufacturerName?.trim();
    if (!safeDto.categoryId && !categoryName)
      throw new BadRequestException('categoryId or categoryName is required');
    if (!safeDto.manufacturerId && !manufacturerName)
      throw new BadRequestException(
        'manufacturerId or manufacturerName is required',
      );

    const existingMedicine = await this.medicineExists(
      safeDto.tradeName,
      safeDto.categoryId,
      safeDto.manufacturerId,
      prisma,
    );

    if (existingMedicine) {
      // Medicine already exists - update its batch/stock instead of creating duplicate
      const batch = safeDto.initialBatch;
      const updatedMedicine = await prisma.medicine.update({
        where: { id: existingMedicine.id },
        data: {
          genericName: safeDto.genericName,
          batches: {
            create: {
              lotNumber: batch.lotNumber,
              batchNumber: batch.batchNumber,
              expiryDate: validateDate(batch.expiryDate, 'expiryDate')!,
              unitCost: batch.unitCost,
              unitSellingPrice: batch.unitSellingPrice,
              initialStock: batch.initialStock,
              currentStock: batch.initialStock + existingMedicine.batches?.reduce(
                (sum, b) => sum + (b.currentStock || 0),
                0,
              ) || batch.initialStock,
              storageConditions: batch.storageConditions,
              minTemperature: batch.minTemperature,
              maxTemperature: batch.maxTemperature,
            },
          },
        },
        include: { category: true, manufacturer: true, batches: true },
      });
      return updatedMedicine;
    }

    // Find or create category
    const category = safeDto.categoryId
      ? await prisma.category.findUnique({
          where: { id: validateUuid(safeDto.categoryId, 'categoryId') },
        })
      : await prisma.category.upsert({
          where: { name: categoryName! },
          update: {},
          create: { name: categoryName! },
        });
    if (!category) throw new NotFoundException('Category not found');

    // Find or create manufacturer
    const manufacturer = safeDto.manufacturerId
      ? await prisma.manufacturer.findUnique({
          where: {
            id: validateUuid(safeDto.manufacturerId, 'manufacturerId'),
          },
        })
      : await prisma.manufacturer.upsert({
          where: { name: manufacturerName! },
          update: {},
          create: { name: manufacturerName! },
        });
    if (!manufacturer) throw new NotFoundException('Manufacturer not found');

    const batch = safeDto.initialBatch;
    const medicine = await prisma.medicine.create({
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
  }

  private async medicineExists(
    tradeName: string,
    categoryId: string | undefined,
    manufacturerId: string | undefined,
    prisma: any,
  ) {
    if (!categoryId || !manufacturerId) return null;
    return await prisma.medicine.findFirst({
      where: {
        tradeName,
        categoryId,
        manufacturerId,
        deletedAt: null,
      },
      include: { category: true, manufacturer: true },
    });
  }

  findAll(
    page: number = 1,
    limit: number = 10,
    includeArchived = false,
    search?: string,
    category?: string,
  ) {
    const prisma = this.prismaService.prisma;
    const safePage = validatePositiveInt(page, 'page', 1);
    const safeLimit = validatePositiveInt(limit, 'limit', 10);
    const skip = (safePage - 1) * safeLimit;
    const safeSearch = search?.trim();
    const safeCategory = category?.trim();

    return prisma.medicine.findMany({
      skip,
      take: safeLimit,
      where: {
        ...(safeSearch
          ? {
              OR: [
                { tradeName: { contains: safeSearch, mode: 'insensitive' } },
                { genericName: { contains: safeSearch, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(safeCategory
          ? {
              category: { name: { equals: safeCategory, mode: 'insensitive' } },
            }
          : {}),
      },
      // Keep the catalogue deterministic and put newly registered medicines first.
      orderBy: { createdAt: 'desc' },
      include: {
        category: true,
        manufacturer: true,
        batches: { select: { storageConditions: true, minTemperature: true, maxTemperature: true } },
      },
    });
  }

  findOne(id: string) {
    const prisma = this.prismaService.prisma;
    const safeId = validateUuid(id, 'id');
    return prisma.medicine.findUnique({
      where: { id: safeId },
      include: {
        category: true,
        manufacturer: true,
        batches: { select: { storageConditions: true, minTemperature: true, maxTemperature: true } },
      },
    });
  }

  async update(id: string, updateMedicineDto: UpdateMedicineDto) {
    const prisma = this.prismaService.prisma;
    const safeId = validateUuid(id, 'id');
    const safeDto = sanitizeDeep(updateMedicineDto);
    const medicine = await prisma.medicine.findUnique({
      where: { id: safeId },
    });
    if (!medicine) throw new NotFoundException('Medicine not found');
    return prisma.medicine.update({ where: { id: safeId }, data: safeDto });
  }

  async remove(id: string) {
    const prisma = this.prismaService.prisma;
    const safeId = validateUuid(id, 'id');
    const medicine = await prisma.medicine.findUnique({
      where: { id: safeId },
    });
    if (!medicine) throw new NotFoundException('Medicine not found');
    return prisma.medicine.delete({ where: { id: safeId } });
  }

  async getAvailability(
    medicineId: string,
    latitude?: number,
    longitude?: number,
    radius: number = 5,
    insuranceId?: string,
  ) {
    const prisma = this.prismaService.prisma;
    const safeId = validateUuid(medicineId, 'medicineId');
    const safeRadius = validatePositiveInt(radius, 'radius', 5);
    const safeLat = latitude !== undefined ? validateGeoCoordinate(latitude, 'latitude', [-90, 90]) : undefined;
    const safeLon = longitude !== undefined ? validateGeoCoordinate(longitude, 'longitude', [-180, 180]) : undefined;

    const inventories = await prisma.inventory.findMany({
      where: {
        medicineId: safeId,
        quantity: { gt: 0 },
        deletedAt: null,
        pharmacy: {
          isActive: true,
          status: 'APPROVED',
          deletedAt: null,
        },
      },
      include: {
        medicine: {
          include: { category: true, manufacturer: true },
        },
        pharmacy: {
          select: {
            id: true,
            name: true,
            address: true,
            phone: true,
            latitude: true,
            longitude: true,
          },
        },
      },
    });

    const results = await Promise.all(
      inventories.map(async (inv) => {
        const baseResult = {
          medicine: inv.medicine,
          pharmacy: inv.pharmacy,
          price: inv.price,
          quantity: inv.quantity,
          expiryDate: inv.expiryDate,
          distance:
            safeLat !== undefined &&
            safeLon !== undefined &&
            inv.pharmacy.latitude &&
            inv.pharmacy.longitude
              ? this.calculateDistance(
                  safeLat,
                  safeLon,
                  parseFloat(inv.pharmacy.latitude.toString()),
                  parseFloat(inv.pharmacy.longitude.toString()),
                )
              : null,
        };

        // Add insurance coverage if insuranceId is provided
        if (insuranceId) {
          const insuranceCoverage = await this.calculateInsuranceCoverage(
            insuranceId,
            inv.pharmacyId,
            inv.medicineId,
            Number(inv.price),
            prisma,
          );
          return { ...baseResult, insuranceCoverage };
        }

        return baseResult;
      }),
    );

    const hasLocation = safeLat !== undefined && safeLon !== undefined;
    const nearbyResults = hasLocation
      ? results.filter(
          (result) => result.distance !== null && result.distance <= safeRadius,
        )
      : results;
    const usedFallback =
      hasLocation && nearbyResults.length === 0 && results.length > 0;
    const selectedResults = usedFallback ? results : nearbyResults;

    selectedResults.sort((a, b) => {
      if (a.distance === null) return 1;
      if (b.distance === null) return -1;
      return a.distance - b.distance;
    });

    return {
      data: selectedResults,
      meta: {
        medicineId: safeId,
        radius: safeRadius,
        total: selectedResults.length,
        usedFallback,
      },
    };
  }

  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(value: number): number {
    return (value * Math.PI) / 180;
  }

  private async calculateInsuranceCoverage(
    insuranceId: string,
    pharmacyId: string,
    medicineId: string,
    retailPrice: number,
    prisma: any,
  ) {
    // Check if pharmacy has active agreement with insurance
    const agreement = await prisma.pharmacyInsuranceAgreement.findUnique({
      where: {
        insuranceId_pharmacyId: {
          insuranceId,
          pharmacyId,
        },
      },
      include: {
        insurance: {
          select: {
            id: true,
            name: true,
            code: true,
            defaultCoveragePercentage: true,
          },
        },
      },
    });

    if (!agreement || agreement.status !== 'ACTIVE') {
      return {
        isCovered: false,
        hasAgreement: false,
        insurancePays: 0,
        patientPays: retailPrice,
        message: 'No active agreement between pharmacy and insurance',
      };
    }

    // Get medicine tariff
    const tariff = await prisma.insuranceMedicineTariff.findUnique({
      where: {
        insuranceId_medicineId: {
          insuranceId,
          medicineId,
        },
      },
    });

    if (!tariff || !tariff.isCovered || tariff.status !== 'ACTIVE') {
      return {
        isCovered: false,
        hasAgreement: true,
        insurancePays: 0,
        patientPays: retailPrice,
        message: 'Medicine not covered by insurance tariff',
        insuranceName: agreement.insurance.name,
        insuranceCode: agreement.insurance.code,
      };
    }

    // Use custom coverage rate from agreement if available, otherwise use tariff rate
    const coveragePercentage = agreement.customCoverageRate
      ? Number(agreement.customCoverageRate)
      : Number(tariff.coveragePercentage);

    let insurancePays: number;
    let patientPays: number;

    if (tariff.fixedCopayAmount) {
      // Fixed copay amount
      insurancePays = Math.max(0, retailPrice - Number(tariff.fixedCopayAmount));
      patientPays = Number(tariff.fixedCopayAmount);
    } else {
      // Percentage-based copay
      insurancePays = retailPrice * (coveragePercentage / 100);
      patientPays = retailPrice - insurancePays;
    }

    return {
      isCovered: true,
      hasAgreement: true,
      insurancePays: Math.round(insurancePays * 100) / 100,
      patientPays: Math.round(patientPays * 100) / 100,
      coveragePercentage,
      copayPercentage: 100 - coveragePercentage,
      requiresPreAuth: tariff.requiresPreAuth,
      coveredPrice: Number(tariff.coveredPrice),
      insuranceName: agreement.insurance.name,
      insuranceCode: agreement.insurance.code,
      insuranceId: agreement.insurance.id,
    };
  }
}
