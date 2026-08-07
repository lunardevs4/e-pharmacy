import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreatePharmacyDto, UpdatePharmacyDto, AddEmployeeDto, ApprovePharmacyDto } from './dto/pharmacies.dto';
import { PharmacyStatus } from '@generated/prisma';
import {
  validatePositiveInt,
  validateEnum,
  validateUuid,
  sanitizeDeep,
} from '../common/security/security.util';

@Injectable()
export class PharmaciesService {
  constructor(private prismaService: PrismaService) { }

  create(ownerId: string, createPharmacyDto: CreatePharmacyDto) {
    const prisma = this.prismaService.prisma;
    const safeDto = sanitizeDeep(createPharmacyDto);
    const {
      name,
      address,
      latitude,
      longitude,
      phone,
      licenseNumber,
      province,
      district,
      managerName,
    } = safeDto;

    return prisma.pharmacy.create({
      data: {
        ownerId,
        name,
        address,
        latitude,
        longitude,
        phone,
        licenseNumber,
        province,
        district,
        managerName,
      },
    });
  }

  async findAll(page: number = 1, limit: number = 10, status?: PharmacyStatus) {
    const prisma = this.prismaService.prisma;
    const safePage = validatePositiveInt(page, 'page', 1);
    const safeLimit = validatePositiveInt(limit, 'limit', 10);
    const safeStatus = status
      ? validateEnum(status as any, PharmacyStatus as any, 'status')
      : undefined;

    const skip = (safePage - 1) * safeLimit;
    const where: any = { deletedAt: null };
    if (safeStatus) where.status = safeStatus;

    const [pharmacies, total] = await Promise.all([
      prisma.pharmacy.findMany({
        skip,
        take: safeLimit,
        where,
        include: { owner: { select: { firstName: true, lastName: true, email: true } } },
      }),
      prisma.pharmacy.count({ where }),
    ]);

    return {
      data: pharmacies,
      meta: { page: safePage, limit: safeLimit, total, totalPages: Math.ceil(total / safeLimit) },
    };
  }

  async findOne(id: string) {
    const prisma = this.prismaService.prisma;
    const safeId = validateUuid(id, 'id');
    const pharmacy = await prisma.pharmacy.findUnique({
      where: { id: safeId },
      include: {
        owner: { select: { firstName: true, lastName: true, email: true } },
        employees: { include: { user: { select: { firstName: true, lastName: true, email: true, role: true } } } },
      },
    });

    if (!pharmacy) throw new NotFoundException('Pharmacy not found');
    return pharmacy;
  }

  async update(id: string, ownerId: string, updatePharmacyDto: UpdatePharmacyDto) {
    const prisma = this.prismaService.prisma;
    const safeId = validateUuid(id, 'id');
    const safeDto = sanitizeDeep(updatePharmacyDto);
    const pharmacy = await prisma.pharmacy.findUnique({ where: { id: safeId } });
    if (!pharmacy) throw new NotFoundException('Pharmacy not found');
    if (pharmacy.ownerId !== ownerId) throw new ForbiddenException('You do not own this pharmacy');

    const {
      name,
      address,
      latitude,
      longitude,
      phone,
      licenseUrl,
      licenseNumber,
      province,
      district,
      managerName,
    } = safeDto;

    return prisma.pharmacy.update({
      where: { id: safeId },
      data: {
        name,
        address,
        latitude,
        longitude,
        phone,
        licenseUrl,
        licenseNumber,
        province,
        district,
        managerName,
      },
    });
  }

  async approve(id: string, approvePharmacyDto: ApprovePharmacyDto) {
    const prisma = this.prismaService.prisma;
    const safeId = validateUuid(id, 'id');
    const safeDto = sanitizeDeep(approvePharmacyDto);
    return prisma.pharmacy.update({ where: { id: safeId }, data: safeDto });
  }

  async addEmployee(id: string, ownerId: string, addEmployeeDto: AddEmployeeDto) {
    const prisma = this.prismaService.prisma;
    const safeId = validateUuid(id, 'id');
    const safeDto = sanitizeDeep(addEmployeeDto);
    const pharmacy = await prisma.pharmacy.findUnique({ where: { id: safeId } });
    if (!pharmacy) throw new NotFoundException('Pharmacy not found');
    if (pharmacy.ownerId !== ownerId) throw new ForbiddenException('You do not own this pharmacy');

    return prisma.pharmacyEmployee.create({
      data: {
        pharmacyId: safeId,
        userId: safeDto.userId,
        role: safeDto.role,
      },
    });
  }

  async removeEmployee(id: string, ownerId: string, employeeId: string) {
    const prisma = this.prismaService.prisma;
    const safeId = validateUuid(id, 'id');
    const safeEmployeeId = validateUuid(employeeId, 'employeeId');
    const pharmacy = await prisma.pharmacy.findUnique({ where: { id: safeId } });
    if (!pharmacy) throw new NotFoundException('Pharmacy not found');
    if (pharmacy.ownerId !== ownerId) throw new ForbiddenException('You do not own this pharmacy');

    return prisma.pharmacyEmployee.delete({ where: { id: safeEmployeeId } });
  }
}
