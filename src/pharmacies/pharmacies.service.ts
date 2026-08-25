import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
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

  // Pharmacy Insurance Management Methods

  async getInsuranceProviders(pharmacyId: string) {
    const prisma = this.prismaService.prisma;
    const safeId = validateUuid(pharmacyId, 'pharmacyId');

    const pharmacy = await prisma.pharmacy.findUnique({
      where: { id: safeId },
    });

    if (!pharmacy) {
      throw new NotFoundException('Pharmacy not found');
    }

    const agreements = await prisma.pharmacyInsuranceAgreement.findMany({
      where: {
        pharmacyId: safeId,
        status: 'ACTIVE',
      },
      include: {
        insurance: {
          select: {
            id: true,
            name: true,
            code: true,
            defaultCoveragePercentage: true,
            defaultCopayPercentage: true,
            status: true,
            isActive: true,
          },
        },
      },
    });

    return agreements.map((agreement) => ({
      id: agreement.insurance.id,
      name: agreement.insurance.name,
      code: agreement.insurance.code,
      defaultCoveragePercentage: agreement.insurance.defaultCoveragePercentage,
      defaultCopayPercentage: agreement.insurance.defaultCopayPercentage,
      status: agreement.insurance.status,
      isActive: agreement.insurance.isActive,
      agreementId: agreement.id,
      customCoverageRate: agreement.customCoverageRate,
      discountRate: agreement.discountRate,
    }));
  }

  async addInsuranceProvider(pharmacyId: string, ownerId: string, data: {
    insuranceId: string;
    contractNumber?: string;
    discountRate?: number;
    customCoverageRate?: number;
    startDate?: string;
    endDate?: string;
  }) {
    const prisma = this.prismaService.prisma;
    const safePharmacyId = validateUuid(pharmacyId, 'pharmacyId');
    const safeInsuranceId = validateUuid(data.insuranceId, 'insuranceId');

    const pharmacy = await prisma.pharmacy.findUnique({
      where: { id: safePharmacyId },
    });

    if (!pharmacy) {
      throw new NotFoundException('Pharmacy not found');
    }

    if (pharmacy.ownerId !== ownerId) {
      throw new ForbiddenException('You do not own this pharmacy');
    }

    const insurance = await prisma.insuranceProvider.findUnique({
      where: { id: safeInsuranceId },
    });

    if (!insurance) {
      throw new NotFoundException('Insurance provider not found');
    }

    if (!insurance.isActive || insurance.status !== 'ACTIVE') {
      throw new BadRequestException('Insurance provider is not active');
    }

    const existingAgreement = await prisma.pharmacyInsuranceAgreement.findUnique({
      where: {
        insuranceId_pharmacyId: {
          insuranceId: safeInsuranceId,
          pharmacyId: safePharmacyId,
        },
      },
    });

    if (existingAgreement) {
      throw new BadRequestException('Agreement already exists with this insurance provider');
    }

    const agreement = await prisma.pharmacyInsuranceAgreement.create({
      data: {
        insuranceId: safeInsuranceId,
        pharmacyId: safePharmacyId,
        contractNumber: data.contractNumber,
        discountRate: data.discountRate || 0,
        customCoverageRate: data.customCoverageRate,
        startDate: data.startDate ? new Date(data.startDate) : new Date(),
        endDate: data.endDate ? new Date(data.endDate) : null,
        status: 'ACTIVE',
      },
      include: {
        insurance: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    return agreement;
  }

  async updateInsuranceAgreement(pharmacyId: string, ownerId: string, agreementId: string, data: {
    contractNumber?: string;
    discountRate?: number;
    customCoverageRate?: number;
    endDate?: string;
    status?: string;
  }) {
    const prisma = this.prismaService.prisma;
    const safePharmacyId = validateUuid(pharmacyId, 'pharmacyId');
    const safeAgreementId = validateUuid(agreementId, 'agreementId');

    const pharmacy = await prisma.pharmacy.findUnique({
      where: { id: safePharmacyId },
    });

    if (!pharmacy) {
      throw new NotFoundException('Pharmacy not found');
    }

    if (pharmacy.ownerId !== ownerId) {
      throw new ForbiddenException('You do not own this pharmacy');
    }

    const agreement = await prisma.pharmacyInsuranceAgreement.findUnique({
      where: { id: safeAgreementId },
    });

    if (!agreement) {
      throw new NotFoundException('Agreement not found');
    }

    if (agreement.pharmacyId !== safePharmacyId) {
      throw new ForbiddenException('This agreement does not belong to your pharmacy');
    }

    const updatedAgreement = await prisma.pharmacyInsuranceAgreement.update({
      where: { id: safeAgreementId },
      data: {
        contractNumber: data.contractNumber,
        discountRate: data.discountRate,
        customCoverageRate: data.customCoverageRate,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        status: data.status,
      },
      include: {
        insurance: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    return updatedAgreement;
  }

  async removeInsuranceProvider(pharmacyId: string, ownerId: string, agreementId: string) {
    const prisma = this.prismaService.prisma;
    const safePharmacyId = validateUuid(pharmacyId, 'pharmacyId');
    const safeAgreementId = validateUuid(agreementId, 'agreementId');

    const pharmacy = await prisma.pharmacy.findUnique({
      where: { id: safePharmacyId },
    });

    if (!pharmacy) {
      throw new NotFoundException('Pharmacy not found');
    }

    if (pharmacy.ownerId !== ownerId) {
      throw new ForbiddenException('You do not own this pharmacy');
    }

    const agreement = await prisma.pharmacyInsuranceAgreement.findUnique({
      where: { id: safeAgreementId },
    });

    if (!agreement) {
      throw new NotFoundException('Agreement not found');
    }

    if (agreement.pharmacyId !== safePharmacyId) {
      throw new ForbiddenException('This agreement does not belong to your pharmacy');
    }

    await prisma.pharmacyInsuranceAgreement.update({
      where: { id: safeAgreementId },
      data: { status: 'TERMINATED' },
    });

    return { message: 'Insurance provider removed successfully' };
  }
}
