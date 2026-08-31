import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class InsuranceDashboardService {
  constructor(private prismaService: PrismaService) {}

  async getSummary(insuranceId?: string) {
    const prisma = this.prismaService.prisma;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfPreviousMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const whereClause = insuranceId ? { insuranceId } : {};

    const totalInsuredPatients = await prisma.insuredPatient.count({
      where: { ...whereClause, status: 'ACTIVE' },
    });

    const newPatientsThisMonth = await prisma.insuredPatient.count({
      where: {
        ...whereClause,
        status: 'ACTIVE',
        createdAt: { gte: startOfMonth },
      },
    });

    const claimsThisMonth = await prisma.insuranceClaim.aggregate({
      where: {
        ...whereClause,
        claimedAt: { gte: startOfMonth },
      },
      _sum: {
        totalAmount: true,
      },
    });

    const totalClaimsAmountThisMonth = Number(claimsThisMonth._sum.totalAmount || 0);

    const claimsPreviousMonth = await prisma.insuranceClaim.aggregate({
      where: {
        ...whereClause,
        claimedAt: {
          gte: startOfPreviousMonth,
          lte: endOfPreviousMonth,
        },
      },
      _sum: {
        totalAmount: true,
      },
    });

    const totalClaimsAmountPreviousMonth = Number(claimsPreviousMonth._sum.totalAmount || 0);
    const claimsGrowthPercentage =
      totalClaimsAmountPreviousMonth > 0
        ? ((totalClaimsAmountThisMonth - totalClaimsAmountPreviousMonth) / totalClaimsAmountPreviousMonth) * 100
        : 0;

    const totalClaimsCount = await prisma.insuranceClaim.count({
      where: { ...whereClause },
    });

    const approvedClaimsCount = await prisma.insuranceClaim.count({
      where: { ...whereClause, status: 'APPROVED' },
    });

    const pendingClaimsCount = await prisma.insuranceClaim.count({
      where: { ...whereClause, status: 'PENDING' },
    });

    const rejectedClaimsCount = await prisma.insuranceClaim.count({
      where: { ...whereClause, status: 'REJECTED' },
    });

    const paidClaimsCount = await prisma.insuranceClaim.count({
      where: { ...whereClause, status: 'PAID' },
    });

    const approvedClaimsAgg = await prisma.insuranceClaim.aggregate({
      where: { ...whereClause, status: 'APPROVED' },
      _sum: { insuranceAmount: true, totalAmount: true },
    });
    const approvedClaimsAmount = Number(approvedClaimsAgg._sum.insuranceAmount || 0);

    const pendingClaimsAgg = await prisma.insuranceClaim.aggregate({
      where: { ...whereClause, status: 'PENDING' },
      _sum: { totalAmount: true },
    });
    const pendingClaimsAmount = Number(pendingClaimsAgg._sum.totalAmount || 0);

    const rejectedClaimsAgg = await prisma.insuranceClaim.aggregate({
      where: { ...whereClause, status: 'REJECTED' },
      _sum: { totalAmount: true },
    });
    const rejectedClaimsAmount = Number(rejectedClaimsAgg._sum.totalAmount || 0);

    const paidClaimsAgg = await prisma.insuranceClaim.aggregate({
      where: { ...whereClause, status: 'PAID' },
      _sum: { insuranceAmount: true },
    });
    const paidClaimsAmount = Number(paidClaimsAgg._sum.insuranceAmount || 0);

    const totalActiveAgreements = await prisma.pharmacyInsuranceAgreement.count({
      where: { ...whereClause, status: 'ACTIVE' },
    });

    const totalCoveredTariffs = await prisma.insuranceMedicineTariff.count({
      where: { ...whereClause, isCovered: true, status: 'ACTIVE' },
    });

    const approvalPercentage =
      totalClaimsCount > 0 ? (approvedClaimsCount / totalClaimsCount) * 100 : 0;

    const outstandingClaims = await prisma.insuranceClaim.findMany({
      where: {
        ...whereClause,
        status: 'APPROVED',
        paidAt: null,
      },
      include: {
        pharmacy: true,
      },
    });

    const outstandingPaymentsAmount = outstandingClaims.reduce(
      (sum, claim) => sum + Number(claim.insuranceAmount),
      0,
    );

    const pharmaciesAwaitingPayout = new Set(
      outstandingClaims.map((claim) => claim.pharmacyId),
    ).size;

    const monthlyTrend = [];
    for (let i = 6; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

      const monthData = await prisma.insuranceClaim.aggregate({
        where: {
          ...whereClause,
          claimedAt: {
            gte: monthStart,
            lte: monthEnd,
          },
        },
        _sum: {
          totalAmount: true,
        },
        _count: true,
      });

      monthlyTrend.push({
        month: monthStart.toLocaleString('default', { month: 'short', year: 'numeric' }),
        volume: monthData._count,
        value: Number(monthData._sum.totalAmount || 0),
      });
    }

    const statusDistribution = await prisma.insuranceClaim.groupBy({
      by: ['status'],
      where: { ...whereClause },
      _count: true,
    });

    const claimsByStatus = {
      PENDING: 0,
      APPROVED: 0,
      REJECTED: 0,
      PAID: 0,
    };

    statusDistribution.forEach((item) => {
      claimsByStatus[item.status as keyof typeof claimsByStatus] = item._count;
    });

    const recentClaims = await prisma.insuranceClaim.findMany({
      where: { ...whereClause },
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
          },
        },
        insuredPatient: {
          select: {
            id: true,
            fullName: true,
            policyNumber: true,
          },
        },
        patient: {
          select: {
            id: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        medicine: {
          select: {
            id: true,
            tradeName: true,
            genericName: true,
          },
        },
      },
      orderBy: { claimedAt: 'desc' },
      take: 10,
    });

    const formattedRecentClaims = recentClaims.map((claim) => ({
      id: claim.id,
      claimNumber: claim.claimNumber,
      patientName: claim.insuredPatient?.fullName ||
        [claim.patient?.user?.firstName, claim.patient?.user?.lastName].filter(Boolean).join(' ') ||
        'Unknown',
      medicineName: claim.medicine?.tradeName || claim.medicine?.genericName || 'Unknown',
      pharmacyName: claim.pharmacy?.name || 'Unknown',
      insuranceName: claim.insurance?.name || 'Unknown',
      pharmacy: {
        name: claim.pharmacy?.name || 'Unknown',
      },
      medicine: {
        tradeName: claim.medicine?.tradeName || 'Unknown',
        genericName: claim.medicine?.genericName || 'Unknown',
      },
      totalAmount: Number(claim.totalAmount),
      insuranceAmount: Number(claim.insuranceAmount),
      patientAmount: Number(claim.patientAmount),
      status: claim.status,
      claimedAt: claim.claimedAt,
      processedAt: claim.processedAt,
      paidAt: claim.paidAt,
    }));

    return {
      summary: {
        totalInsuredPatients,
        newPatientsThisMonth,
        totalClaimsCount,
        totalClaimsAmountThisMonth: Number(totalClaimsAmountThisMonth),
        claimsGrowthPercentage: Number(claimsGrowthPercentage.toFixed(2)),
        approvedClaimsCount,
        approvedClaimsAmount,
        approvalPercentage: Number(approvalPercentage.toFixed(2)),
        pendingClaimsCount,
        pendingClaimsAmount,
        rejectedClaimsCount,
        rejectedClaimsAmount,
        paidClaimsCount,
        paidClaimsAmount,
        outstandingPaymentsAmount: Number(outstandingPaymentsAmount),
        pharmaciesAwaitingPayout,
        totalActiveAgreements,
        totalCoveredTariffs,
      },
      monthlyTrend,
      claimsByStatus,
      recentClaims: formattedRecentClaims,
    };
  }

  async getProviders() {
    const prisma = this.prismaService.prisma;

    const providers = await prisma.insuranceProvider.findMany({
      where: {
        isActive: true,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        name: true,
        code: true,
        email: true,
        phone: true,
        address: true,
        defaultCoveragePercentage: true,
        defaultCopayPercentage: true,
        status: true,
        isActive: true,
      },
      orderBy: { name: 'asc' },
    });

    return providers;
  }

  async getProviderById(providerId: string) {
    const prisma = this.prismaService.prisma;

    const provider = await prisma.insuranceProvider.findUnique({
      where: { id: providerId },
    });

    if (!provider) {
      throw new NotFoundException('Insurance provider not found');
    }

    return provider;
  }

  async updateProvider(providerId: string, data: {
    name?: string;
    logoUrl?: string;
    email?: string;
    phone?: string;
    address?: string;
    defaultCoveragePercentage?: number;
    defaultCopayPercentage?: number;
    status?: string;
    isActive?: boolean;
  }, user?: any) {
    const prisma = this.prismaService.prisma;

    const provider = await prisma.insuranceProvider.findUnique({
      where: { id: providerId },
    });

    if (!provider) {
      throw new NotFoundException('Insurance provider not found');
    }

    if (user && user.role !== 'ADMIN') {
      if (provider.userId !== user.id) {
        throw new ForbiddenException('You do not have permission to update this insurance provider');
      }
    }

    if (data.defaultCoveragePercentage !== undefined) {
      if (data.defaultCoveragePercentage < 0 || data.defaultCoveragePercentage > 100) {
        throw new BadRequestException('Coverage percentage must be between 0 and 100');
      }
    }

    if (data.defaultCopayPercentage !== undefined) {
      if (data.defaultCopayPercentage < 0 || data.defaultCopayPercentage > 100) {
        throw new BadRequestException('Copay percentage must be between 0 and 100');
      }
    }

    if (data.defaultCoveragePercentage !== undefined && data.defaultCopayPercentage !== undefined) {
      const total = data.defaultCoveragePercentage + data.defaultCopayPercentage;
      if (Math.abs(total - 100) > 0.01) {
        throw new BadRequestException('Coverage percentage and copay percentage must sum to 100');
      }
    }

    const updatedProvider = await prisma.insuranceProvider.update({
      where: { id: providerId },
      data: {
        name: data.name,
        logoUrl: data.logoUrl,
        email: data.email,
        phone: data.phone,
        address: data.address,
        defaultCoveragePercentage: data.defaultCoveragePercentage,
        defaultCopayPercentage: data.defaultCopayPercentage,
        status: data.status,
        isActive: data.isActive,
      },
    });

    return updatedProvider;
  }
}
