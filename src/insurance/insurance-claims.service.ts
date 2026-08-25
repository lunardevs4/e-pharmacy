import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateInsuranceClaimDto, UpdateClaimStatusDto, BatchPayClaimsDto, ClaimStatus } from './dto/insurance.dto';
import { InsuranceCalculationService } from './insurance-calculation.service';

@Injectable()
export class InsuranceClaimsService {
  constructor(
    private prismaService: PrismaService,
    private calculationService: InsuranceCalculationService,
  ) {}

  async createClaim(dto: CreateInsuranceClaimDto) {
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

    // Verify medicine exists
    const medicine = await prisma.medicine.findUnique({
      where: { id: dto.medicineId },
    });

    if (!medicine) {
      throw new NotFoundException('Medicine not found');
    }

    // Calculate insurance payment using the calculation service
    const calculation = await this.calculationService.calculatePayments({
      pharmacyId: dto.pharmacyId,
      insuranceId: dto.insuranceId,
      medicines: [{
        medicineId: dto.medicineId,
        quantity: dto.quantity,
        unitPrice: dto.unitPrice,
      }],
      patientId: dto.patientId,
      insuredPatientId: dto.insuredPatientId,
    });

    const medicineCalculation = calculation.medicines[0];

    // Generate claim number
    const claimNumber = await this.generateClaimNumber(dto.insuranceId);

    const claim = await prisma.insuranceClaim.create({
      data: {
        claimNumber,
        insuranceId: dto.insuranceId,
        pharmacyId: dto.pharmacyId,
        insuredPatientId: dto.insuredPatientId,
        patientId: dto.patientId,
        medicineId: dto.medicineId,
        prescriptionId: dto.prescriptionId,
        reservationId: dto.reservationId,
        quantity: dto.quantity,
        unitPrice: dto.unitPrice,
        totalAmount: medicineCalculation.totalAmount,
        insuranceAmount: medicineCalculation.insurancePays,
        patientAmount: medicineCalculation.patientPays,
        notes: dto.notes,
        status: 'PENDING',
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
    });

    return claim;
  }

  async getClaims(
    insuranceId?: string,
    pharmacyId?: string,
    status?: string,
    startDate?: string,
    endDate?: string,
    page: number = 1,
    limit: number = 10,
  ) {
    const prisma = this.prismaService.prisma;

    const where: any = {};
    if (insuranceId) where.insuranceId = insuranceId;
    if (pharmacyId) where.pharmacyId = pharmacyId;
    if (status) where.status = status;
    if (startDate || endDate) {
      where.claimedAt = {};
      if (startDate) where.claimedAt.gte = new Date(startDate);
      if (endDate) where.claimedAt.lte = new Date(endDate);
    }

    const [claims, total] = await Promise.all([
      prisma.insuranceClaim.findMany({
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
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.insuranceClaim.count({ where }),
    ]);

    return {
      data: claims,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getClaimById(claimId: string) {
    const prisma = this.prismaService.prisma;

    const claim = await prisma.insuranceClaim.findUnique({
      where: { id: claimId },
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
          },
        },
        insuredPatient: {
          select: {
            id: true,
            fullName: true,
            policyNumber: true,
            nationalId: true,
          },
        },
        patient: {
          select: {
            id: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
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
        prescription: {
          select: {
            id: true,
            status: true,
            notes: true,
          },
        },
        reservation: {
          select: {
            id: true,
            status: true,
            quantity: true,
          },
        },
      },
    });

    if (!claim) {
      throw new NotFoundException('Claim not found');
    }

    return claim;
  }

  async updateClaimStatus(claimId: string, dto: UpdateClaimStatusDto) {
    const prisma = this.prismaService.prisma;

    const claim = await prisma.insuranceClaim.findUnique({
      where: { id: claimId },
    });

    if (!claim) {
      throw new NotFoundException('Claim not found');
    }

    // Validate status transitions
    const validTransitions: Record<string, string[]> = {
      PENDING: ['APPROVED', 'REJECTED'],
      APPROVED: ['PAID', 'REJECTED'],
      REJECTED: [],
      PAID: [],
    };

    if (!validTransitions[claim.status]?.includes(dto.status)) {
      throw new BadRequestException(
        `Invalid status transition from ${claim.status} to ${dto.status}`,
      );
    }

    const updatedClaim = await prisma.insuranceClaim.update({
      where: { id: claimId },
      data: {
        status: dto.status,
        rejectionReason: dto.rejectionReason,
        processedAt: dto.status !== 'PENDING' ? new Date() : claim.processedAt,
        paidAt: dto.status === 'PAID' ? new Date() : claim.paidAt,
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
    });

    return updatedClaim;
  }

  async batchPayClaims(dto: BatchPayClaimsDto) {
    const prisma = this.prismaService.prisma;

    const results = [];

    for (const claimId of dto.claimIds) {
      try {
        const claim = await prisma.insuranceClaim.findUnique({
          where: { id: claimId },
        });

        if (!claim) {
          results.push({ success: false, claimId, error: 'Claim not found' });
          continue;
        }

        if (claim.status !== 'APPROVED') {
          results.push({
            success: false,
            claimId,
            error: `Claim must be APPROVED to pay, current status: ${claim.status}`,
          });
          continue;
        }

        const updatedClaim = await prisma.insuranceClaim.update({
          where: { id: claimId },
          data: {
            status: 'PAID',
            paidAt: new Date(),
          },
        });

        results.push({ success: true, claimId, claim: updatedClaim });
      } catch (error: any) {
        results.push({ success: false, claimId, error: error.message });
      }
    }

    return {
      total: dto.claimIds.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
    };
  }

  async getOutstandingPayments(pharmacyId?: string) {
    const prisma = this.prismaService.prisma;

    const where: any = {
      status: 'APPROVED',
      paidAt: null,
    };

    if (pharmacyId) {
      where.pharmacyId = pharmacyId;
    }

    const outstandingClaims = await prisma.insuranceClaim.findMany({
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
      orderBy: { claimedAt: 'asc' },
    });

    const totalOutstanding = outstandingClaims.reduce(
      (sum, claim) => sum + Number(claim.insuranceAmount),
      0,
    );

    return {
      totalOutstanding,
      claimCount: outstandingClaims.length,
      claims: outstandingClaims,
    };
  }

  private async generateClaimNumber(insuranceId: string): Promise<string> {
    const prisma = this.prismaService.prisma;

    const insurance = await prisma.insuranceProvider.findUnique({
      where: { id: insuranceId },
    });

    if (!insurance) {
      throw new NotFoundException('Insurance provider not found');
    }

    const year = new Date().getFullYear();
    const prefix = `${insurance.code}-${year}`;

    // Find the latest claim number for this insurance
    const latestClaim = await prisma.insuranceClaim.findFirst({
      where: {
        insuranceId,
        claimNumber: {
          startsWith: prefix,
        },
      },
      orderBy: { claimNumber: 'desc' },
    });

    let sequence = 1;
    if (latestClaim) {
      const parts = latestClaim.claimNumber.split('-');
      const lastSequence = parseInt(parts[parts.length - 1], 10);
      sequence = lastSequence + 1;
    }

    return `${prefix}-${String(sequence).padStart(6, '0')}`;
  }
}
