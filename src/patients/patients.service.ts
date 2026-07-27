import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreatePatientDto, UpdatePatientDto } from './dto/patients.dto';
import { validateUuid, sanitizeDeep, validateDate } from '../common/security/security.util';

@Injectable()
export class PatientsService {
  constructor(private prismaService: PrismaService) { }

  async create(userId: string, createPatientDto: CreatePatientDto) {
    const prisma = this.prismaService.prisma;
    const safeUserId = validateUuid(userId, 'userId');
    const safeDto = sanitizeDeep(createPatientDto);
    const dateOfBirth = validateDate((safeDto as any).dateOfBirth, 'dateOfBirth');

    return prisma.patient.create({
      data: {
        userId: safeUserId,
        ...safeDto,
        ...(dateOfBirth ? { dateOfBirth } : {}),
      },
    });
  }

  async findOne(userId: string) {
    const prisma = this.prismaService.prisma;
    const safeUserId = validateUuid(userId, 'userId');
    const patient = await prisma.patient.findFirst({
      where: { userId: safeUserId, user: { deletedAt: null } },
      include: { user: { select: { firstName: true, lastName: true, email: true, phone: true } } },
    });

    if (!patient) {
      throw new NotFoundException('Patient profile not found');
    }

    return patient;
  }

  async update(userId: string, updatePatientDto: UpdatePatientDto) {
    const prisma = this.prismaService.prisma;
    const safeUserId = validateUuid(userId, 'userId');
    const safeDto = sanitizeDeep(updatePatientDto);
    const patient = await prisma.patient.findFirst({ where: { userId: safeUserId } });
    if (!patient) {
      throw new NotFoundException('Patient profile not found');
    }

    const dateOfBirth = (safeDto as any).dateOfBirth !== undefined
      ? validateDate((safeDto as any).dateOfBirth, 'dateOfBirth')
      : undefined;

    return prisma.patient.update({
      where: { id: patient.id },
      data: {
        ...safeDto,
        ...(dateOfBirth !== undefined ? { dateOfBirth } : {}),
      },
    });
  }
}
