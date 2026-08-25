import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreatePrescriptionDto, UpdatePrescriptionStatusDto } from './dto/prescriptions.dto';
import { UserRole } from '@generated/prisma';
import { validateUuid, sanitizeDeep } from '../common/security/security.util';

interface AuthenticatedUser {
  id: string;
  role: UserRole;
}

@Injectable()
export class PrescriptionsService {
  constructor(private prismaService: PrismaService) { }

  async create(user: AuthenticatedUser, createPrescriptionDto: CreatePrescriptionDto) {
    const prisma = this.prismaService.prisma;
    const safeUserId = validateUuid(user.id, 'userId');
    const safeDto = sanitizeDeep(createPrescriptionDto);
    const patient = await prisma.patient.findFirst({ where: { userId: safeUserId } });
    if (!patient) throw new NotFoundException('Patient profile not found');

    const { medicines, ...rest } = safeDto;

    return prisma.prescription.create({
      data: {
        patientId: patient.id,
        ...rest,
        medicines: {
          create: medicines.map((m) => ({
            medicineId: validateUuid(m.medicineId, 'medicineId'),
            dosage: m.dosage,
            frequency: m.frequency,
            duration: m.duration,
            quantity: m.quantity,
          })),
        },
      },
      include: { medicines: true },
    });
  }

  async findByPatient(user: AuthenticatedUser) {
    const prisma = this.prismaService.prisma;
    const safeUserId = validateUuid(user.id, 'userId');
    const patient = await prisma.patient.findFirst({ where: { userId: safeUserId } });
    if (!patient) throw new NotFoundException('Patient profile not found');

    return prisma.prescription.findMany({
      where: { patientId: patient.id },
      include: {
        medicines: { include: { medicine: true } },
        pharmacy: true,
        pharmacist: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async ensurePharmacyViewAccess(pharmacyId: string, user: AuthenticatedUser) {
    const prisma = this.prismaService.prisma;
    const safePharmacyId = validateUuid(pharmacyId, 'pharmacyId');
    const pharmacy = await prisma.pharmacy.findUnique({ where: { id: safePharmacyId } });
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
        throw new ForbiddenException('You are not employed as a pharmacist at this pharmacy');
      }
      return { pharmacy, safePharmacyId };
    }

    throw new ForbiddenException('Insufficient permissions to access prescriptions for this pharmacy');
  }

  private async ensurePharmacyWriteAccess(pharmacyId: string, user: AuthenticatedUser) {
    const prisma = this.prismaService.prisma;
    const safePharmacyId = validateUuid(pharmacyId, 'pharmacyId');
    const pharmacy = await prisma.pharmacy.findUnique({ where: { id: safePharmacyId } });
    if (!pharmacy) throw new NotFoundException('Pharmacy not found');

    if (user.role === UserRole.ADMIN) {
      return { pharmacy, safePharmacyId };
    }

    if (user.role === UserRole.PHARMACY_OWNER || (user.role as string) === 'PHARMACY') {
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
        throw new ForbiddenException('You are not employed as a pharmacist at this pharmacy');
      }
      return { pharmacy, safePharmacyId };
    }

    throw new ForbiddenException('Insufficient permissions to manage prescriptions for this pharmacy');
  }

  async findByPharmacy(pharmacyId: string, user: AuthenticatedUser) {
    const prisma = this.prismaService.prisma;
    const { safePharmacyId } = await this.ensurePharmacyViewAccess(pharmacyId, user);

    return prisma.prescription.findMany({
      where: { pharmacyId: safePharmacyId },
      include: {
        patient: { include: { user: true } },
        medicines: { include: { medicine: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateStatus(pharmacyId: string, user: AuthenticatedUser, id: string, updateDto: UpdatePrescriptionStatusDto) {
    const prisma = this.prismaService.prisma;
    const { safePharmacyId } = await this.ensurePharmacyWriteAccess(pharmacyId, user);
    const safeId = validateUuid(id, 'id');
    const safeUserId = validateUuid(user.id, 'userId');
    const safeDto = sanitizeDeep(updateDto);

    return prisma.prescription.update({
      where: { id: safeId, pharmacyId: safePharmacyId },
      data: { ...safeDto, pharmacistId: safeUserId },
    });
  }
}
