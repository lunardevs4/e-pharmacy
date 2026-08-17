import { Injectable } from '@nestjs/common';
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

    // Total insured patients count
    const totalInsuredPatients = await prisma.insuredPatient.count({
      where: { ...whereClause, status: 'ACTIVE' },
    });

    // New patients this month
    const newPatientsThisMonth = await prisma.insuredPatient.count({
      where: {
        ...whereClause,
        status: 'ACTIVE',
        createdAt: { gte: startOfMonth },
      },
    });

    // Total claims amount this month
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

    // Total claims amount previous month for growth calculation
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

    // Approved claims count and approval percentage
    const totalClaimsCount = await prisma.insuranceClaim.count({
      where: { ...whereClause },
    });

    const approvedClaimsCount = await prisma.insuranceClaim.count({
      where: { ...whereClause, status: 'APPROVED' },
    });

    const approvalPercentage =
      totalClaimsCount > 0 ? (approvedClaimsCount / totalClaimsCount) * 100 : 0;

    // Outstanding payments amount and count of pharmacies awaiting payout
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

    // Monthly claims trend (last 7 months)
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

    // Claims by status distribution
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

    // Recent claims list
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
                   `${claim.patient?.user.firstName} ${claim.patient?.user.lastName}` ||
                   'Unknown',
      medicineName: claim.medicine?.tradeName || claim.medicine?.genericName || 'Unknown',
      pharmacyName: claim.pharmacy?.name || 'Unknown',
      insuranceName: claim.insurance?.name || 'Unknown',
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
        totalClaimsAmountThisMonth: Number(totalClaimsAmountThisMonth),
        claimsGrowthPercentage: Number(claimsGrowthPercentage.toFixed(2)),
        approvedClaimsCount,
        approvalPercentage: Number(approvalPercentage.toFixed(2)),
        outstandingPaymentsAmount: Number(outstandingPaymentsAmount),
        pharmaciesAwaitingPayout,
      },
      monthlyTrend,
      claimsByStatus,
      recentClaims: formattedRecentClaims,
    };
  }
}
