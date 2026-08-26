import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  CreateReservationDto,
  UpdateReservationStatusDto,
} from './dto/reservations.dto';
import { UserRole, ReservationStatus } from '@generated/prisma';
import {
  validateUuid,
  sanitizeDeep,
  validateDate,
} from '../common/security/security.util';

interface AuthenticatedUser {
  id: string;
  role: UserRole;
}

@Injectable()
export class ReservationsService {
  constructor(private prismaService: PrismaService) {}

  async create(
    user: AuthenticatedUser,
    createReservationDto: CreateReservationDto,
  ) {
    const prisma = this.prismaService.prisma;
    const safeUserId = validateUuid(user.id, 'userId');
    const safeDto = sanitizeDeep(createReservationDto);

    if (user.role !== UserRole.PATIENT) {
      throw new ForbiddenException('Only patients can create reservations');
    }

    const patient = await prisma.patient.upsert({
      where: { userId: safeUserId },
      update: {},
      create: { userId: safeUserId },
    });

    const expiresAt = validateDate((safeDto as any).expiresAt, 'expiresAt') ||
      new Date(Date.now() + 24 * 60 * 60 * 1000);
    const { expiresAt: _stripExpiry, ...restDto } = safeDto as any;

    return prisma.reservation.create({
      data: {
        patientId: patient.id,
        ...restDto,
        expiresAt,
      },
    });
  }

  async findByPatient(user: AuthenticatedUser) {
    const prisma = this.prismaService.prisma;
    const safeUserId = validateUuid(user.id, 'userId');

    if (user.role !== UserRole.PATIENT) {
      throw new ForbiddenException(
        'Only patients can view their personal reservations via this endpoint',
      );
    }

    // Auto-provision the patient profile so accounts created before the
    // profile link existed (or via other flows) never 404 here.
    const patient = await prisma.patient.upsert({
      where: { userId: safeUserId },
      update: {},
      create: { userId: safeUserId },
    });

    return prisma.reservation.findMany({
      where: { patientId: patient.id },
      include: { medicine: true, pharmacy: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Patient's reservations whose pickup window has passed without collection. */
  async findLateForPatient(user: AuthenticatedUser) {
    const prisma = this.prismaService.prisma;
    const safeUserId = validateUuid(user.id, 'userId');

    if (user.role !== UserRole.PATIENT) {
      throw new ForbiddenException(
        'Only patients can view their late pickups via this endpoint',
      );
    }

    const patient = await prisma.patient.upsert({
      where: { userId: safeUserId },
      update: {},
      create: { userId: safeUserId },
    });

    const now = new Date();
    const stale = await prisma.reservation.findMany({
      where: {
        patientId: patient.id,
        status: { in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED] },
        expiresAt: { lt: now },
      },
      include: { medicine: true, pharmacy: true },
      orderBy: { expiresAt: 'asc' },
    });

    return stale.map((reservation) => ({
      id: reservation.id,
      medicineName:
        reservation.medicine?.tradeName || reservation.medicine?.genericName || 'Medication',
      pharmacyName: reservation.pharmacy?.name || 'Pharmacy',
      pickupDeadline: reservation.expiresAt,
      hoursLate: Math.max(
        0,
        Math.floor((now.getTime() - new Date(reservation.expiresAt).getTime()) / (1000 * 60 * 60)),
      ),
      quantity: reservation.quantity,
      status: reservation.status,
    }));
  }

  async cancelPatient(user: AuthenticatedUser, id: string) {
    const prisma = this.prismaService.prisma;
    const safeUserId = validateUuid(user.id, 'userId');
    const safeId = validateUuid(id, 'id');

    if (user.role !== UserRole.PATIENT) {
      throw new ForbiddenException(
        'Only patients can cancel their own reservations via this endpoint',
      );
    }

    const patient = await prisma.patient.findFirst({
      where: { userId: safeUserId },
    });
    if (!patient) throw new NotFoundException('Patient profile not found');

    const reservation = await prisma.reservation.findUnique({
      where: { id: safeId },
    });
    if (!reservation) throw new NotFoundException('Reservation not found');
    if (reservation.patientId !== patient.id) {
      throw new ForbiddenException('This reservation does not belong to you');
    }

    return prisma.reservation.update({
      where: { id: safeId },
      data: { status: ReservationStatus.CANCELLED },
    });
  }

  private async ensurePharmacyViewAccess(
    pharmacyId: string,
    user: AuthenticatedUser,
  ) {
    const prisma = this.prismaService.prisma;
    const safePharmacyId = validateUuid(pharmacyId, 'pharmacyId');
    const pharmacy = await prisma.pharmacy.findUnique({
      where: { id: safePharmacyId },
    });
    if (!pharmacy) throw new NotFoundException('Pharmacy not found');

    if (user.role === UserRole.PHARMACY_OWNER) {
      if (pharmacy.ownerId !== user.id) {
        throw new ForbiddenException('You do not own this pharmacy');
      }
      return { pharmacy, safePharmacyId };
    }

    if (user.role === UserRole.PHARMACIST) {
      const employee = await prisma.pharmacyEmployee.findFirst({
        where: {
          pharmacyId: safePharmacyId,
          userId: user.id,
          role: UserRole.PHARMACIST,
        },
      });
      if (!employee) {
        throw new ForbiddenException(
          'You are not employed as a pharmacist at this pharmacy',
        );
      }
      return { pharmacy, safePharmacyId };
    }

    throw new ForbiddenException(
      'Insufficient permissions to access reservations for this pharmacy',
    );
  }

  private async ensurePharmacyWriteAccess(
    pharmacyId: string,
    user: AuthenticatedUser,
  ) {
    const prisma = this.prismaService.prisma;
    const safePharmacyId = validateUuid(pharmacyId, 'pharmacyId');
    const pharmacy = await prisma.pharmacy.findUnique({
      where: { id: safePharmacyId },
    });
    if (!pharmacy) throw new NotFoundException('Pharmacy not found');

    if (user.role === UserRole.ADMIN) return { pharmacy, safePharmacyId };

    if (user.role === UserRole.PHARMACY_OWNER || (user.role as string) === 'PHARMACY') {
      if (pharmacy.ownerId !== user.id) {
        throw new ForbiddenException('You do not own this pharmacy');
      }
      return { pharmacy, safePharmacyId };
    }

    if (user.role === UserRole.PHARMACIST) {
      const employee = await prisma.pharmacyEmployee.findFirst({
        where: { pharmacyId: safePharmacyId, userId: user.id },
      });
      if (!employee) {
        throw new ForbiddenException(
          'You are not employed as a pharmacist at this pharmacy',
        );
      }
      return { pharmacy, safePharmacyId };
    }

    throw new ForbiddenException(
      'Insufficient permissions to manage reservations for this pharmacy',
    );
  }

  async findByPharmacy(pharmacyId: string, user: AuthenticatedUser) {
    const prisma = this.prismaService.prisma;
    const { safePharmacyId } = await this.ensurePharmacyViewAccess(
      pharmacyId,
      user,
    );

    const reservations = await prisma.reservation.findMany({
      where: { pharmacyId: safePharmacyId },
      include: {
        patient: { include: { user: true } },
        medicine: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Reservations intentionally keep stock prices in Inventory rather than
    // duplicating them. Enrich the pharmacy response with the current total
    // and the patient's actual co-pay so the portal does not display zero.
    const inventory = await prisma.inventory.findMany({
      where: {
        pharmacyId: safePharmacyId,
        medicineId: { in: reservations.map((reservation) => reservation.medicineId) },
        deletedAt: null,
      },
      select: { medicineId: true, price: true },
    });

    return Promise.all(
      reservations.map(async (reservation) => {
        const stock = inventory.find((item) => item.medicineId === reservation.medicineId);
        const unitPrice = stock ? Number(stock.price) : 0;
        const totalPrice = unitPrice * reservation.quantity;
        const providerName = reservation.patient.insuranceProvider?.trim();

        let insurancePays = 0;
        if (providerName && totalPrice > 0) {
          const provider = await prisma.insuranceProvider.findFirst({
            where: {
              OR: [
                { code: providerName },
                { name: providerName },
              ],
              isActive: true,
            },
          });

          if (provider) {
            const agreement = await prisma.pharmacyInsuranceAgreement.findUnique({
              where: {
                insuranceId_pharmacyId: {
                  insuranceId: provider.id,
                  pharmacyId: safePharmacyId,
                },
              },
            });
            const tariff = await prisma.insuranceMedicineTariff.findUnique({
              where: {
                insuranceId_medicineId: {
                  insuranceId: provider.id,
                  medicineId: reservation.medicineId,
                },
              },
            });

            if (agreement?.status === 'ACTIVE' && tariff?.status === 'ACTIVE' && tariff.isCovered) {
              const coveragePercentage = agreement.customCoverageRate
                ? Number(agreement.customCoverageRate)
                : Number(tariff.coveragePercentage);
              const coveredBase = Number(tariff.coveredPrice) > 0
                ? Math.min(unitPrice, Number(tariff.coveredPrice)) * reservation.quantity
                : totalPrice;
              insurancePays = tariff.fixedCopayAmount
                ? Math.max(0, totalPrice - Number(tariff.fixedCopayAmount) * reservation.quantity)
                : coveredBase * (coveragePercentage / 100);
            }
          }
        }

        return {
          ...reservation,
          insuranceProvider: providerName || null,
          unitPrice,
          totalPrice,
          insurancePays: Math.round(insurancePays * 100) / 100,
          patientPays: Math.round((totalPrice - insurancePays) * 100) / 100,
        };
      }),
    );
  }

  async updatePharmacyStatus(
    pharmacyId: string,
    user: AuthenticatedUser,
    id: string,
    updateDto: UpdateReservationStatusDto,
  ) {
    const prisma = this.prismaService.prisma;
    const { safePharmacyId } = await this.ensurePharmacyWriteAccess(
      pharmacyId,
      user,
    );
    const safeId = validateUuid(id, 'id');
    const safeDto = sanitizeDeep(updateDto);

    const reservation = await prisma.reservation.findUnique({
      where: { id: safeId, pharmacyId: safePharmacyId },
      include: { medicine: true },
    });

    if (!reservation) {
      throw new NotFoundException('Reservation not found');
    }

    // Decrement inventory when reservation is collected
    if (safeDto.status === ReservationStatus.COLLECTED) {
      if (reservation.status !== ReservationStatus.COLLECTED) {
        // Find inventory for this medicine at this pharmacy
        const inventory = await prisma.inventory.findFirst({
          where: {
            pharmacyId: safePharmacyId,
            medicineId: reservation.medicineId,
            deletedAt: null,
          },
        });

        if (inventory) {
          const newQuantity = Math.max(0, inventory.quantity - reservation.quantity);
          await prisma.inventory.update({
            where: { id: inventory.id },
            data: { quantity: newQuantity },
          });

          // Record stock movement
          await prisma.stockMovement.create({
            data: {
              inventoryId: inventory.id,
              type: 'REMOVE',
              quantity: reservation.quantity,
              reason: 'Reservation pickup',
              movedBy: user.id,
            },
          });
        }
      }
    }

    return prisma.reservation.update({
      where: { id: safeId, pharmacyId: safePharmacyId },
      data: safeDto,
    });
  }
}
