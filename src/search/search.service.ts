import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  validateSafeString,
  validateUuid,
  validatePositiveInt,
  validateGeoCoordinate,
} from '../common/security/security.util';

@Injectable()
export class SearchService {
  constructor(private prismaService: PrismaService) {}

  async searchMedicines(
    query?: string,
    categoryId?: string,
    latitude?: number,
    longitude?: number,
    radius: number = 5,
    page: number = 1,
    limit: number = 10,
    insuranceId?: string,
  ) {
    const prisma = this.prismaService.prisma;
    const safePage = validatePositiveInt(page, 'page', 1);
    const safeLimit = validatePositiveInt(limit, 'limit', 10);
    const safeRadius = validatePositiveInt(radius, 'radius', 5);
    const safeQuery = query
      ? validateSafeString(query, 'query', 200)
      : undefined;
    const safeCategoryId = categoryId
      ? validateUuid(categoryId, 'categoryId')
      : undefined;
    const safeLat = validateGeoCoordinate(latitude, 'latitude', [-90, 90]);
    const safeLon = validateGeoCoordinate(longitude, 'longitude', [-180, 180]);

    const where: any = {
      medicine: {
        is: {},
      },
      quantity: { gt: 0 },
      pharmacy: { isActive: true, status: 'APPROVED', deletedAt: null },
    };

    if (safeQuery) {
      where.medicine.is.OR = [
        { tradeName: { contains: safeQuery, mode: 'insensitive' } },
        { genericName: { contains: safeQuery, mode: 'insensitive' } },
      ];
    }

    if (safeCategoryId) {
      where.medicine.is.categoryId = safeCategoryId;
    }

    const inventories = await prisma.inventory.findMany({
      where,
      include: {
        medicine: { include: { category: true, manufacturer: true } },
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

    const results = await Promise.all(inventories.map(async (inv) => {
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
    }));

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
      const relevanceDifference =
        this.getMedicineMatchRank(b.medicine, safeQuery) -
        this.getMedicineMatchRank(a.medicine, safeQuery);

      if (relevanceDifference !== 0) {
        return relevanceDifference;
      }

      if (a.distance === null) return 1;
      if (b.distance === null) return -1;
      return a.distance - b.distance;
    });

    const skip = (safePage - 1) * safeLimit;

    return {
      data: selectedResults.slice(skip, skip + safeLimit),
      meta: {
        page: safePage,
        limit: safeLimit,
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

  private getMedicineMatchRank(medicine: any, query?: string): number {
    if (!query) return 0;

    const normalizedQuery = query.trim().toLowerCase();
    const tradeName = String(medicine.tradeName ?? '').toLowerCase();
    const genericName = String(medicine.genericName ?? '').toLowerCase();

    if (tradeName === normalizedQuery) return 4;
    if (genericName === normalizedQuery) return 3;
    if (tradeName.startsWith(normalizedQuery)) return 2;
    if (genericName.startsWith(normalizedQuery)) return 1;
    return 0;
  }

  private toRad(Value: number): number {
    return (Value * Math.PI) / 180;
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
