import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { validatePositiveInt } from '../common/security/security.util';

@Injectable()
export class GovernmentDashboardService {
  constructor(private prismaService: PrismaService) { }

  async getPublicStats() {
    const prisma = this.prismaService.prisma;
    const [registeredPharmacies, patientsRegistered, pharmacies, medicines, stockedEntries] =
      await Promise.all([
        prisma.pharmacy.count({ where: { deletedAt: null } }),
        prisma.patient.count(),
        prisma.pharmacy.findMany({
          where: { status: 'APPROVED', isActive: true, deletedAt: null },
          select: { province: true },
        }),
        prisma.medicine.count(),
        prisma.inventory.count({
          where: {
            quantity: { gt: 0 },
            deletedAt: null,
            pharmacy: { status: 'APPROVED', isActive: true, deletedAt: null },
          },
        }),
      ]);

    const coveredProvinces = new Set(
      pharmacies.map(({ province }) => province?.trim()).filter(Boolean),
    ).size;
    const possibleStockEntries = pharmacies.length * medicines;

    return {
      registeredPharmacies,
      patientsRegistered,
      provincesCovered: coveredProvinces,
      nationalAvailability: possibleStockEntries
        ? Number(((stockedEntries / possibleStockEntries) * 100).toFixed(1))
        : 0,
    };
  }

  async getSummary() {
    const prisma = this.prismaService.prisma;
    
    const pharmacies = await prisma.pharmacy.findMany({
      select:{
        id:true,
        name:true,
        status:true,
        deletedAt:true,
      },
    })

    console.log("Pharmacies seen by Prisma: ",pharmacies);
    const [
      totalPharmacies,
      approvedPharmacies,
      totalMedicines,
      totalPatients,
      totalReservations,
      pendingReservations,
    ] = await Promise.all([
      prisma.pharmacy.count({ where: { deletedAt: null } }),
      prisma.pharmacy.count({ where: { status: 'APPROVED', deletedAt: null } }),
       prisma.medicine.count(),
      prisma.patient.count(),
      prisma.reservation.count(),
      prisma.reservation.count({ where: { status: 'PENDING' } }),
    ]);

    console.log({
      totalPharmacies,
      approvedPharmacies
    })

    return {
      totalPharmacies,
      approvedPharmacies,
      totalMedicines,
      totalPatients,
      totalReservations,
      pendingReservations,
    };
  }

  async getMedicineAvailability() {
    const prisma = this.prismaService.prisma;
    const result = await prisma.inventory.groupBy({
      by: ['medicineId'],
      _sum: { quantity: true },
      where: { deletedAt: null },
    });

    return Promise.all(
      result.map(async (item) => {
        const medicine = await prisma.medicine.findUnique({
          where: { id: item.medicineId },
           select: { id: true, tradeName: true, genericName: true },
        });
        return {
          medicine,
          totalStock: item._sum.quantity,
        };
      }),
    );
  }

  async getLowStockMedicines(threshold: number = 10) {
    const prisma = this.prismaService.prisma;
    const safeThreshold = validatePositiveInt(threshold, 'threshold', 10);
    return prisma.inventory.findMany({
      where: {
        quantity: { lt: safeThreshold },
        deletedAt: null,
        pharmacy: { status: 'APPROVED', deletedAt: null },
      },
      include: {
        medicine: true,
        pharmacy: { select: { id: true, name: true, address: true, district: true, province: true } },
      },
    });
  }

  async getDistrictCoverage() {
    const prisma = this.prismaService.prisma;
    const [totalMedicines, pharmacies] = await Promise.all([
      prisma.medicine.count(),
      prisma.pharmacy.findMany({
        where: { status: 'APPROVED', deletedAt: null },
        select: {
          id: true,
          district: true,
          province: true,
          inventories: {
            where: { deletedAt: null },
            select: { medicineId: true, quantity: true },
          },
          _count: { select: { reservations: true } },
        },
      }),
    ]);

    const districts = new Map<string, {
      district: string;
      province: string;
      approvedPharmacies: number;
      stockedMedicineEntries: number;
      reservations: number;
    }>();

    pharmacies.forEach((pharmacy) => {
      const district = pharmacy.district || 'Unknown';
      const existing = districts.get(district) || {
        district,
        province: pharmacy.province || 'Unknown',
        approvedPharmacies: 0,
        stockedMedicineEntries: 0,
        reservations: 0,
      };

      existing.approvedPharmacies += 1;
      existing.stockedMedicineEntries += pharmacy.inventories.filter((item) => item.quantity > 0).length;
      existing.reservations += pharmacy._count.reservations;
      districts.set(district, existing);
    });

    return Array.from(districts.values()).map((district) => ({
      district: district.district,
      province: district.province,
      approvedPharmacies: district.approvedPharmacies,
      stockedMedicineEntries: district.stockedMedicineEntries,
      totalMedicineEntries: district.approvedPharmacies * totalMedicines,
      coverage: totalMedicines > 0
        ? Math.round((district.stockedMedicineEntries / (district.approvedPharmacies * totalMedicines)) * 100)
        : 0,
      reservations: district.reservations,
    }));
  }

  async getReservationStats() {
    const prisma = this.prismaService.prisma;
    return prisma.reservation.groupBy({
      by: ['status'],
      _count: { id: true },
    });
  }
}
