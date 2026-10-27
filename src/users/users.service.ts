import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { UpdateUserDto } from './dto/users.dto';
import {
  validatePositiveInt,
  validateUuid,
  sanitizeDeep,
  getSafePaginationParams,
} from '../common/security/security.util';

@Injectable()
export class UsersService {
  constructor(private prismaService: PrismaService) {}

  async getProfile(userId: string) {
    const prisma = this.prismaService.prisma;
    const safeUserId = validateUuid(userId, 'userId');
    const user = await prisma.user.findUnique({
      where: { id: safeUserId },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        role: true,
        position: true,
        permissions: true,
        firstLogin: true,
        isActive: true,
        createdAt: true,
        patient: true,
        pharmacyOwner: {
          include: { pharmacy: true },
        },
        pharmacyEmployees: {
          include: { pharmacy: true },
        },
        insuranceProvider: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }
    const ownedPharmacy = user.pharmacyOwner?.pharmacy ?? null;
    const employedPharmacy = user.pharmacyEmployees?.[0]?.pharmacy ?? null;
    const {
      pharmacyOwner,
      pharmacyEmployees,
      insuranceProvider,
      patient,
      ...rest
    } = user;

    return {
      ...rest,
      pharmacy: ownedPharmacy || employedPharmacy,
      insuranceProvider:
        patient?.insuranceProvider ||
        (typeof insuranceProvider === 'string'
          ? insuranceProvider
          : insuranceProvider?.code || insuranceProvider?.name || null),
      province: patient?.province ?? null,
      district: patient?.district ?? null,
      sector: patient?.sector ?? null,
      cell: patient?.cell ?? null,
      village: patient?.village ?? null,
      emergencyContact: patient?.emergencyContact ?? null,
      preferredPharmacy: patient?.preferredPharmacy ?? null,
      medicalNotes: patient?.medicalNotes ?? null,
      profilePhoto: patient?.profilePhoto ?? null,
    };
  }

  async updateProfile(userId: string, updateUserDto: UpdateUserDto) {
    const prisma = this.prismaService.prisma;
    const safeUserId = validateUuid(userId, 'userId');
    const safeDto = sanitizeDeep(updateUserDto);
    const {
      insuranceProvider,
      province,
      district,
      sector,
      cell,
      village,
      emergencyContact,
      preferredPharmacy,
      medicalNotes,
      profilePhoto,
      ...userFields
    } = safeDto;

    let normalizedInsuranceProvider: string | null | undefined = undefined;
    if (insuranceProvider !== undefined) {
      const trimmed = typeof insuranceProvider === 'string' ? insuranceProvider.trim() : '';
      if (!trimmed || trimmed === 'None' || trimmed.toLowerCase() === 'none' || trimmed.toLowerCase() === 'null') {
        normalizedInsuranceProvider = null;
      } else {
        // Must match a registered active insurance provider on the platform
        const registered = await prisma.insuranceProvider.findFirst({
          where: {
            isActive: true,
            status: 'ACTIVE',
            OR: [
              { code: trimmed },
              { name: trimmed },
              { id: trimmed },
            ],
          },
        });
        if (!registered) {
          throw new BadRequestException(
            `Insurance provider "${trimmed}" is not a registered active provider on this platform.`,
          );
        }
        normalizedInsuranceProvider = registered.code || registered.name;
      }
    }

    await prisma.$transaction(async (tx) => {
      const userUpdateData: Record<string, any> = {};
      if (userFields.firstName !== undefined) userUpdateData.firstName = userFields.firstName;
      if (userFields.lastName !== undefined) userUpdateData.lastName = userFields.lastName;
      if (userFields.phone !== undefined) userUpdateData.phone = userFields.phone;
      if (userFields.email !== undefined && userFields.email) userUpdateData.email = userFields.email;

      if (Object.keys(userUpdateData).length > 0) {
        await tx.user.update({ where: { id: safeUserId }, data: userUpdateData });
      }

      const existingPatient = await tx.patient.findUnique({
        where: { userId: safeUserId },
      });
      const currentUser = await tx.user.findUnique({
        where: { id: safeUserId },
        select: { role: true },
      });

      if (existingPatient || currentUser?.role === 'PATIENT') {
        await tx.patient.upsert({
          where: { userId: safeUserId },
          create: {
            userId: safeUserId,
            insuranceProvider: normalizedInsuranceProvider ?? null,
            province: province || null,
            district: district || null,
            sector: sector || null,
            cell: cell || null,
            village: village || null,
            emergencyContact: emergencyContact || null,
            preferredPharmacy: preferredPharmacy || null,
            medicalNotes: medicalNotes || null,
            profilePhoto: profilePhoto || null,
          },
          update: {
            insuranceProvider:
              normalizedInsuranceProvider !== undefined
                ? normalizedInsuranceProvider
                : undefined,
            province: province !== undefined ? province : undefined,
            district: district !== undefined ? district : undefined,
            sector: sector !== undefined ? sector : undefined,
            cell: cell !== undefined ? cell : undefined,
            village: village !== undefined ? village : undefined,
            emergencyContact:
              emergencyContact !== undefined ? emergencyContact : undefined,
            preferredPharmacy:
              preferredPharmacy !== undefined ? preferredPharmacy : undefined,
            medicalNotes: medicalNotes !== undefined ? medicalNotes : undefined,
            profilePhoto: profilePhoto !== undefined ? profilePhoto : undefined,
          },
        });
      }
    });

    return this.getProfile(safeUserId);
  }

  async softDelete(userId: string) {
    const prisma = this.prismaService.prisma;
    const safeUserId = validateUuid(userId, 'userId');
    return prisma.user.update({
      where: { id: safeUserId },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  async updateStatus(userId: string, isActive: boolean) {
    const prisma = this.prismaService.prisma;
    const safeUserId = validateUuid(userId, 'userId');
    const user = await prisma.user.findUnique({ where: { id: safeUserId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return prisma.user.update({
      where: { id: safeUserId },
      data: { isActive },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  async deleteByAdmin(userId: string) {
    const prisma = this.prismaService.prisma;
    const safeUserId = validateUuid(userId, 'userId');
    const user = await prisma.user.findUnique({ where: { id: safeUserId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return prisma.user.delete({
      where: { id: safeUserId },
      select: { id: true },
    });
  }

  async findAll(page: number = 1, limit: number = 10) {
    const prisma = this.prismaService.prisma;
    const { page: safePage, limit: safeLimit, skip, take } = getSafePaginationParams(
      page,
      limit,
      10,
      100,
    );
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        skip,
        take,
        where: { deletedAt: null },
        select: {
          id: true,
          email: true,
          phone: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
      }),
      prisma.user.count({ where: { deletedAt: null } }),
    ]);

    return {
      data: users,
      meta: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }
}
