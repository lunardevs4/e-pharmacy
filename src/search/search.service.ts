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
  constructor(private prismaService: PrismaService) { }

  async searchMedicines(
    query?: string,
    categoryId?: string,
    latitude?: number,
    longitude?: number,
    radius: number = 5,
    page: number = 1,
    limit: number = 10,
  ) {
    const prisma = this.prismaService.prisma;
    const safePage = validatePositiveInt(page, 'page', 1);
    const safeLimit = validatePositiveInt(limit, 'limit', 10);
    const safeRadius = validatePositiveInt(radius, 'radius', 5);
    const safeQuery = query ? validateSafeString(query, 'query', 200) : undefined;
    const safeCategoryId = categoryId ? validateUuid(categoryId, 'categoryId') : undefined;
    const safeLat = validateGeoCoordinate(latitude, 'latitude', [-90, 90]);
    const safeLon = validateGeoCoordinate(longitude, 'longitude', [-180, 180]);

    const skip = (safePage - 1) * safeLimit;

    const where: any = {
      medicine: {
        isActive: true,
        deletedAt: null,
      },
      quantity: { gt: 0 },
      pharmacy: { isActive: true, status: 'APPROVED', deletedAt: null },
    };

    if (safeQuery) {
      where.medicine.OR = [
        { name: { contains: safeQuery, mode: 'insensitive' } },
        { genericName: { contains: safeQuery, mode: 'insensitive' } },
      ];
    }

    if (safeCategoryId) {
      where.medicine.categoryId = safeCategoryId;
    }

    const inventories = await prisma.inventory.findMany({
      skip,
      take: safeLimit,
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

    const results = inventories.map((inv) => ({
      medicine: inv.medicine,
      pharmacy: inv.pharmacy,
      price: inv.price,
      quantity: inv.quantity,
      expiryDate: inv.expiryDate,
      distance:
        safeLat !== undefined && safeLon !== undefined && inv.pharmacy.latitude && inv.pharmacy.longitude
          ? this.calculateDistance(
            safeLat,
            safeLon,
            parseFloat(inv.pharmacy.latitude.toString()),
            parseFloat(inv.pharmacy.longitude.toString()),
          )
          : null,
    }));

    return {
      data: results,
      meta: { page: safePage, limit: safeLimit, radius: safeRadius },
    };
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(Value: number): number {
    return (Value * Math.PI) / 180;
  }
}
