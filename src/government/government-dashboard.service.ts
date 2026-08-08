import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { validatePositiveInt } from '../common/security/security.util';

@Injectable()
export class GovernmentDashboardService {
  constructor(private prismaService: PrismaService) { }

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
      prisma.medicine.count({ where: { isActive: true, deletedAt: null } }),
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
          select: { id: true, name: true, genericName: true },
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
      },
      include: {
        medicine: true,
        pharmacy: { select: { id: true, name: true, address: true, district: true, province: true } },
      },
    });
  }

  async getReservationStats() {
    const prisma = this.prismaService.prisma;
    return prisma.reservation.groupBy({
      by: ['status'],
      _count: { id: true },
    });
  }
}
