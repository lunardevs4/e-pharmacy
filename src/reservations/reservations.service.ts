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

    if (user.role !== UserRole.PHARMACIST) {
      throw new ForbiddenException(
        'Only pharmacists can confirm/manage reservation status',
      );
    }

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

    return prisma.reservation.update({
      where: { id: safeId, pharmacyId: safePharmacyId },
      data: safeDto,
    });
  }
}
