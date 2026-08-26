import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreatePharmacyAgreementDto, UpdatePharmacyAgreementDto } from './dto/insurance.dto';

@Injectable()
export class InsurancePharmaciesService {
  constructor(private prismaService: PrismaService) {}

  async getPharmacyInsuranceOptions(pharmacyId: string) {
    const prisma = this.prismaService.prisma;
    const [providers, agreements] = await Promise.all([
      prisma.insuranceProvider.findMany({
        where: { isActive: true, status: 'ACTIVE' },
        select: { id: true, name: true, code: true, logoUrl: true },
        orderBy: { name: 'asc' },
      }),
      prisma.pharmacyInsuranceAgreement.findMany({
        where: { pharmacyId },
        select: { id: true, insuranceId: true, status: true, contractNumber: true, discountRate: true, customCoverageRate: true, startDate: true, endDate: true },
      }),
    ]);

    const agreementByProvider = new Map(agreements.map((agreement) => [agreement.insuranceId, agreement]));
    return providers.map((provider) => ({
      provider,
      agreement: agreementByProvider.get(provider.id) || null,
      enabled: agreementByProvider.get(provider.id)?.status === 'ACTIVE',
    }));
  }

  async setPharmacyInsurance(pharmacyId: string, insuranceId: string, enabled: boolean, userId: string) {
    const prisma = this.prismaService.prisma;
    const pharmacy = await prisma.pharmacy.findUnique({ where: { id: pharmacyId }, select: { id: true, ownerId: true } });
    if (!pharmacy) throw new NotFoundException('Pharmacy not found');
    if (pharmacy.ownerId !== userId) throw new BadRequestException('Only the pharmacy owner can manage insurance agreements');

    const provider = await prisma.insuranceProvider.findUnique({ where: { id: insuranceId }, select: { id: true } });
    if (!provider) throw new NotFoundException('Insurance provider not found');

    return prisma.pharmacyInsuranceAgreement.upsert({
      where: { insuranceId_pharmacyId: { insuranceId, pharmacyId } },
      create: {
        insuranceId,
        pharmacyId,
        contractNumber: `PHARMACY-${pharmacyId.slice(0, 8)}-${insuranceId.slice(0, 8)}`,
        discountRate: 0,
        status: enabled ? 'ACTIVE' : 'INACTIVE',
        startDate: new Date(),
      },
      update: { status: enabled ? 'ACTIVE' : 'INACTIVE' },
      include: { insurance: { select: { id: true, name: true, code: true } } },
    });
  }

  async createAgreement(dto: CreatePharmacyAgreementDto) {
    const prisma = this.prismaService.prisma;

    // Verify insurance exists
    const insurance = await prisma.insuranceProvider.findUnique({
      where: { id: dto.insuranceId },
    });

    if (!insurance) {
      throw new NotFoundException('Insurance provider not found');
    }

    // Verify pharmacy exists
    const pharmacy = await prisma.pharmacy.findUnique({
      where: { id: dto.pharmacyId },
    });

    if (!pharmacy) {
      throw new NotFoundException('Pharmacy not found');
    }

    // Check if agreement already exists
    const existingAgreement = await prisma.pharmacyInsuranceAgreement.findUnique({
      where: {
        insuranceId_pharmacyId: {
          insuranceId: dto.insuranceId,
          pharmacyId: dto.pharmacyId,
        },
      },
    });

    if (existingAgreement) {
      throw new BadRequestException('Agreement already exists between this insurance and pharmacy');
    }

    const agreement = await prisma.pharmacyInsuranceAgreement.create({
      data: {
        insuranceId: dto.insuranceId,
        pharmacyId: dto.pharmacyId,
        contractNumber: dto.contractNumber,
        discountRate: dto.discountRate || 0,
        customCoverageRate: dto.customCoverageRate,
        startDate: dto.startDate ? new Date(dto.startDate) : new Date(),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        status: dto.status || 'ACTIVE',
      },
      include: {
        insurance: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        pharmacy: {
          select: {
            id: true,
            name: true,
            address: true,
            phone: true,
          },
        },
      },
    });

    return agreement;
  }

  async updateAgreement(agreementId: string, dto: UpdatePharmacyAgreementDto) {
    const prisma = this.prismaService.prisma;

    const agreement = await prisma.pharmacyInsuranceAgreement.findUnique({
      where: { id: agreementId },
    });

    if (!agreement) {
      throw new NotFoundException('Agreement not found');
    }

    const updatedAgreement = await prisma.pharmacyInsuranceAgreement.update({
      where: { id: agreementId },
      data: {
        contractNumber: dto.contractNumber,
        discountRate: dto.discountRate,
        customCoverageRate: dto.customCoverageRate,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        status: dto.status,
      },
      include: {
        insurance: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        pharmacy: {
          select: {
            id: true,
            name: true,
            address: true,
            phone: true,
          },
        },
      },
    });

    return updatedAgreement;
  }

  async getAgreements(insuranceId?: string, pharmacyId?: string, status?: string) {
    const prisma = this.prismaService.prisma;

    const where: any = {};
    if (insuranceId) where.insuranceId = insuranceId;
    if (pharmacyId) where.pharmacyId = pharmacyId;
    if (status) where.status = status;

    const agreements = await prisma.pharmacyInsuranceAgreement.findMany({
      where,
      include: {
        insurance: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        pharmacy: {
          select: {
            id: true,
            name: true,
            address: true,
            phone: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return agreements;
  }

  async getAgreementById(agreementId: string) {
    const prisma = this.prismaService.prisma;

    const agreement = await prisma.pharmacyInsuranceAgreement.findUnique({
      where: { id: agreementId },
      include: {
        insurance: {
          select: {
            id: true,
            name: true,
            code: true,
            email: true,
            phone: true,
          },
        },
        pharmacy: {
          select: {
            id: true,
            name: true,
            address: true,
            phone: true,
            status: true,
          },
        },
      },
    });

    if (!agreement) {
      throw new NotFoundException('Agreement not found');
    }

    return agreement;
  }

  async getPharmacyClaimsSummary(pharmacyId: string) {
    const prisma = this.prismaService.prisma;

    const claims = await prisma.insuranceClaim.findMany({
      where: { pharmacyId },
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

    const totalClaims = claims.length;
    const outstandingClaims = claims.filter(c => c.status === 'APPROVED' && !c.paidAt);
    const outstandingAmount = outstandingClaims.reduce((sum, claim) => sum + Number(claim.insuranceAmount), 0);
    const paidAmount = claims.filter(c => c.status === 'PAID').reduce((sum, claim) => sum + Number(claim.insuranceAmount), 0);

    const claimsByInsurance = claims.reduce((acc, claim) => {
      const insuranceName = claim.insurance.name;
      if (!acc[insuranceName]) {
        acc[insuranceName] = {
          totalClaims: 0,
          outstandingAmount: 0,
          paidAmount: 0,
        };
      }
      acc[insuranceName].totalClaims++;
      if (claim.status === 'APPROVED' && !claim.paidAt) {
        acc[insuranceName].outstandingAmount += Number(claim.insuranceAmount);
      } else if (claim.status === 'PAID') {
        acc[insuranceName].paidAmount += Number(claim.insuranceAmount);
      }
      return acc;
    }, {} as Record<string, { totalClaims: number; outstandingAmount: number; paidAmount: number }>);

    return {
      pharmacyId,
      totalClaims,
      outstandingClaimsCount: outstandingClaims.length,
      outstandingAmount,
      paidAmount,
      claimsByInsurance,
    };
  }

  async syncTariffUpdates(insuranceId: string) {
    const prisma = this.prismaService.prisma;

    // Get all active agreements for this insurance
    const agreements = await prisma.pharmacyInsuranceAgreement.findMany({
      where: {
        insuranceId,
        status: 'ACTIVE',
      },
      include: {
        pharmacy: true,
      },
    });

    // Get all tariffs for this insurance
    const tariffs = await prisma.insuranceMedicineTariff.findMany({
      where: {
        insuranceId,
        status: 'ACTIVE',
      },
    });

    // In a real implementation, this would trigger events or update pharmacy pricing
    // For now, we return the affected pharmacies and tariff count
    return {
      insuranceId,
      affectedPharmacies: agreements.length,
      tariffUpdates: tariffs.length,
      pharmacies: agreements.map(a => ({
        pharmacyId: a.pharmacyId,
        pharmacyName: a.pharmacy.name,
        agreementStatus: a.status,
      })),
    };
  }
}
