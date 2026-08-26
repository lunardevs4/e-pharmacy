import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { UserRole } from '@generated/prisma';
import { validateUuid, validateDate } from '../common/security/security.util';

interface AuthenticatedUser {
  id: string;
  role: UserRole;
}

@Injectable()
export class ReportsService {
  constructor(private prismaService: PrismaService) { }

  private async ensurePharmacyReportAccess(pharmacyId: string, user: AuthenticatedUser) {
    const prisma = this.prismaService.prisma;
    const safePharmacyId = validateUuid(pharmacyId, 'pharmacyId');
    const pharmacy = await prisma.pharmacy.findUnique({ where: { id: safePharmacyId } });
    if (!pharmacy) throw new NotFoundException('Pharmacy not found');

    if (user.role === UserRole.ADMIN) return { pharmacy, safePharmacyId };

    if (user.role === UserRole.PHARMACY_OWNER) {
      if (pharmacy.ownerId !== user.id) {
        throw new ForbiddenException('You do not own this pharmacy');
      }
      return { pharmacy, safePharmacyId };
    }

    if (user.role === UserRole.PHARMACIST) {
      const employee = await prisma.pharmacyEmployee.findFirst({
        where: { pharmacyId: safePharmacyId, userId: user.id, role: UserRole.PHARMACIST },
      });
      if (!employee) {
        throw new ForbiddenException('You are not employed as a pharmacist at this pharmacy');
      }
      return { pharmacy, safePharmacyId };
    }

    throw new ForbiddenException('Insufficient permissions to access this pharmacy report');
  }

  async pharmacyReport(pharmacyId: string, user: AuthenticatedUser, startDate?: string, endDate?: string) {
    const prisma = this.prismaService.prisma;
    const { safePharmacyId } = await this.ensurePharmacyReportAccess(pharmacyId, user);
    const safeStartDate = startDate ? validateDate(startDate, 'startDate') : undefined;
    const safeEndDate = endDate ? validateDate(endDate, 'endDate') : undefined;

    const dateFilter: any = {};
    if (safeStartDate) dateFilter.gte = safeStartDate;
    if (safeEndDate) dateFilter.lte = safeEndDate;

    const [pharmacy, reservations, inventoryValue] = await Promise.all([
      prisma.pharmacy.findUnique({ where: { id: safePharmacyId } }),
      prisma.reservation.findMany({
        where: {
          pharmacyId: safePharmacyId,
          ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
        },
        include: {
          medicine: true,
          patient: { include: { user: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.inventory.aggregate({
        where: { pharmacyId: safePharmacyId },
        _sum: { quantity: true },
      }),
    ]);

    const totalInventoryCount = inventoryValue._sum.quantity ?? 0;

    return {
      pharmacy,
      totalReservations: reservations.length,
      totalInventoryCount,
      reservations,
    };
  }

  async medicineReport(user: AuthenticatedUser, startDate?: string, endDate?: string) {
    const prisma = this.prismaService.prisma;
    const safeStartDate = startDate ? validateDate(startDate, 'startDate') : undefined;
    const safeEndDate = endDate ? validateDate(endDate, 'endDate') : undefined;
    void safeStartDate; void safeEndDate;

    if (user.role === UserRole.ADMIN) {
      return prisma.medicine.findMany({
        where: {},
        include: {
          category: true,
          manufacturer: true,
          inventories: {
            select: {
              quantity: true,
              price: true,
              pharmacy: { select: { id: true, name: true } },
            },
          },
        },
      });
    }

    if (user.role === UserRole.PHARMACY_OWNER) {
      const ownedPharmacies = await prisma.pharmacy.findMany({
        where: { ownerId: user.id },
        select: { id: true },
      });
      const pharmacyIds = ownedPharmacies.map((p) => p.id);
      return prisma.medicine.findMany({
        where: {
          inventories: { some: { pharmacyId: { in: pharmacyIds } } },
        },
        include: {
          category: true,
          manufacturer: true,
          inventories: {
            where: { pharmacyId: { in: pharmacyIds } },
            select: {
              quantity: true,
              price: true,
              pharmacy: { select: { id: true, name: true } },
            },
          },
        },
      });
    }

    if (user.role === UserRole.PHARMACIST) {
      const staff = await prisma.pharmacyEmployee.findMany({
        where: { userId: user.id, role: UserRole.PHARMACIST },
        select: { pharmacyId: true },
      });
      const pharmacyIds = staff.map((s) => s.pharmacyId);
      return prisma.medicine.findMany({
        where: {
          inventories: { some: { pharmacyId: { in: pharmacyIds } } },
        },
        include: {
          category: true,
          manufacturer: true,
          inventories: {
            where: { pharmacyId: { in: pharmacyIds } },
            select: {
              quantity: true,
              price: true,
              pharmacy: { select: { id: true, name: true } },
            },
          },
        },
      });
    }

    throw new ForbiddenException('Insufficient permissions to access medicines report');
  }

  async patientReport(user: AuthenticatedUser, startDate?: string, endDate?: string) {
    const prisma = this.prismaService.prisma;
    const safeUserId = validateUuid(user.id, 'userId');
    const safeStartDate = startDate ? validateDate(startDate, 'startDate') : undefined;
    const safeEndDate = endDate ? validateDate(endDate, 'endDate') : undefined;

    // Auto-provision patient profile like reservations service does
    const patient = await prisma.patient.upsert({
      where: { userId: safeUserId },
      update: {},
      create: { userId: safeUserId },
    });

    const dateFilter: any = {};
    if (safeStartDate) dateFilter.gte = safeStartDate;
    if (safeEndDate) dateFilter.lte = safeEndDate;

    const [reservationRows, prescriptions] = await Promise.all([
      prisma.reservation.findMany({
        where: {
          patientId: patient.id,
          ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
        },
        include: { medicine: true, pharmacy: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.prescription.findMany({
        where: {
          patientId: patient.id,
          ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
        },
        include: { medicines: { include: { medicine: true } }, pharmacy: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const inventoryPrices = await prisma.inventory.findMany({
      where: {
        pharmacyId: { in: reservationRows.map((reservation) => reservation.pharmacyId) },
        medicineId: { in: reservationRows.map((reservation) => reservation.medicineId) },
        deletedAt: null,
      },
      select: { pharmacyId: true, medicineId: true, price: true },
    });

    const reservations = reservationRows.map((reservation) => {
      const inventory = inventoryPrices.find(
        (item) => item.pharmacyId === reservation.pharmacyId && item.medicineId === reservation.medicineId,
      );
      const unitPrice = inventory ? Number(inventory.price) : 0;

      return {
        ...reservation,
        unitPrice,
        totalPrice: unitPrice * reservation.quantity,
      };
    });

    const reservationSummary = {
      total: reservations.length,
      confirmed: reservations.filter((r) => r.status === 'CONFIRMED').length,
      collected: reservations.filter((r) => r.status === 'COLLECTED').length,
      cancelled: reservations.filter((r) => r.status === 'CANCELLED').length,
    };

    return {
      patientId: patient.id,
      reservationSummary,
      totalPrescriptions: prescriptions.length,
      reservations,
      prescriptions,
    };
  }

  async insuranceReport(user: AuthenticatedUser) {
    const prisma = this.prismaService.prisma;

    if (user.role !== UserRole.INSURANCE && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only INSURANCE or ADMIN can access insurance reports');
    }

    const [claims, reservations] = await Promise.all([
      prisma.reservation.findMany({
        include: { patient: true, pharmacy: true, medicine: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.reservation.count(),
    ]);

    return {
      totalClaims: claims.length,
      approvedClaims: claims.filter((item) => item.status === 'CONFIRMED').length,
      pendingClaims: claims.filter((item) => item.status === 'PENDING').length,
      totalCost: claims.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
      claims: claims.map((item) => ({
        id: item.id,
        pharmacy: item.pharmacy ? { name: item.pharmacy.name } : null,
        patientNid: item.patient?.userId || null,
        drug: item.medicine?.tradeName || 'Medication',
        totalCost: Number(item.quantity || 0),
        insurancePay: Number(item.quantity || 0),
        patientPay: 0,
        status: item.status,
      })),
      reservations,
    };
  }

  async governmentReport(user: AuthenticatedUser, startDate?: string, endDate?: string) {
    const prisma = this.prismaService.prisma;
    const safeStartDate = startDate ? validateDate(startDate, 'startDate') : undefined;
    const safeEndDate = endDate ? validateDate(endDate, 'endDate') : undefined;

    if (user.role !== UserRole.GOVERNMENT && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only GOVERNMENT or ADMIN can access national reports');
    }

    const dateFilter: any = {};
    if (safeStartDate) dateFilter.gte = new Date(safeStartDate);
    if (safeEndDate) dateFilter.lte = new Date(safeEndDate);
    const whereCreated = Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {};

    const [
      totalPharmacies,
      totalPatients,
      totalReservations,
      reservationsByStatus,
      totalInventory,
    ] = await Promise.all([
      prisma.pharmacy.count({ where: { deletedAt: null } }),
      prisma.patient.count(),
      prisma.reservation.count({ where: whereCreated }),
      prisma.reservation.groupBy({
        by: ['status'],
        _count: { id: true },
        where: whereCreated,
      }),
      prisma.inventory.aggregate({
        where: { deletedAt: null },
        _sum: { quantity: true },
      }),
    ]);

    return {
      reportType: 'NATIONAL',
      totalPharmacies,
      totalPatients,
      totalReservations,
      reservationsByStatus,
      totalInventory: totalInventory._sum.quantity ?? 0,
    };
  }

  async platformReport(startDate?: string, endDate?: string) {
    const prisma = this.prismaService.prisma;
    const safeStartDate = startDate ? validateDate(startDate, 'startDate') : undefined;
    const safeEndDate = endDate ? validateDate(endDate, 'endDate') : undefined;

    const dateFilter: any = {};
    if (safeStartDate) dateFilter.gte = new Date(safeStartDate);
    if (safeEndDate) dateFilter.lte = new Date(safeEndDate);
    const whereCreated = Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {};

    const [
      totalUsers,
      usersByRole,
      totalPharmacies,
      pharmaciesByStatus,
      totalMedicines,
      totalPatients,
      totalReservations,
      reservationsByStatus,
      totalInventory,
      totalPrescriptions,
      totalAuditLogs,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.groupBy({ by: ['role'], _count: { id: true } }),
      prisma.pharmacy.count({ where: { deletedAt: null } }),
      prisma.pharmacy.groupBy({ by: ['status'], _count: { id: true }, where: { deletedAt: null } }),
       prisma.medicine.count(),
      prisma.patient.count(),
      prisma.reservation.count({ where: whereCreated }),
      prisma.reservation.groupBy({ by: ['status'], _count: { id: true }, where: whereCreated }),
      prisma.inventory.aggregate({ where: { deletedAt: null }, _sum: { quantity: true } }),
      prisma.prescription.count({ where: whereCreated }),
      prisma.auditLog.count({ where: whereCreated }),
    ]);

    return {
      reportType: 'PLATFORM',
      users: {
        total: totalUsers,
        byRole: usersByRole.map((r: any) => ({ role: r.role, count: r._count.id })),
      },
      pharmacies: {
        total: totalPharmacies,
        byStatus: pharmaciesByStatus.map((r: any) => ({ status: r.status, count: r._count.id })),
      },
      medicines: { activeTotal: totalMedicines },
      patients: { total: totalPatients },
      reservations: {
        total: totalReservations,
        byStatus: reservationsByStatus.map((r: any) => ({ status: r.status, count: r._count.id })),
      },
      prescriptions: { total: totalPrescriptions },
      inventory: { totalUnitsInStock: totalInventory._sum.quantity ?? 0 },
      auditLogs: { totalEvents: totalAuditLogs },
    };
  }
}
