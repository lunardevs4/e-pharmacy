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

    const expiresAt = validateDate((safeDto as any).expiresAt, 'expiresAt');
    const { expiresAt: _stripExpiry, ...restDto } = safeDto as any;

    return prisma.reservation.create({
      data: {
        patientId: patient.id,
        ...restDto,
        ...(expiresAt ? { expiresAt } : {}),
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

    const patient = await prisma.patient.findFirst({
      where: { userId: safeUserId },
    });
    if (!patient) throw new NotFoundException('Patient profile not found');

    return prisma.reservation.findMany({
      where: { patientId: patient.id },
      include: { medicine: true, pharmacy: true },
      orderBy: { createdAt: 'desc' },
    });
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

    return prisma.reservation.findMany({
      where: { pharmacyId: safePharmacyId },
      include: {
        patient: { include: { user: true } },
        medicine: true,
      },
      orderBy: { createdAt: 'desc' },
    });
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
