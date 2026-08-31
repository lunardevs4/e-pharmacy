import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { RegisterInsuredPatientDto, VerifyPolicyDto } from './dto/insurance.dto';

@Injectable()
export class InsuredPatientsService {
  constructor(private prismaService: PrismaService) {}

  async registerPatient(dto: RegisterInsuredPatientDto) {
    const prisma = this.prismaService.prisma;

    const insurance = await prisma.insuranceProvider.findUnique({
      where: { id: dto.insuranceId },
    });

    if (!insurance) {
      throw new NotFoundException('Insurance provider not found');
    }

    if (dto.patientId) {
      const patient = await prisma.patient.findUnique({
        where: { id: dto.patientId },
      });

      if (!patient) {
        throw new NotFoundException('Patient not found');
      }
    }

    const existingPolicy = await prisma.insuredPatient.findUnique({
      where: { policyNumber: dto.policyNumber },
    });

    if (existingPolicy) {
      throw new BadRequestException('Policy number already exists');
    }

    if (dto.nationalId) {
      const existingNationalId = await prisma.insuredPatient.findFirst({
        where: {
          insuranceId: dto.insuranceId,
          nationalId: dto.nationalId,
        },
      });

      if (existingNationalId) {
        throw new BadRequestException('National ID already registered with this insurance');
      }
    }

    const insuredPatient = await prisma.insuredPatient.create({
      data: {
        insuranceId: dto.insuranceId,
        patientId: dto.patientId,
        policyNumber: dto.policyNumber,
        nationalId: dto.nationalId,
        fullName: dto.fullName,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
        gender: dto.gender,
        phone: dto.phone,
        coveragePercentage: dto.coveragePercentage,
        startDate: dto.startDate ? new Date(dto.startDate) : new Date(),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        dependentName: dto.dependentName,
        dependentRelationship: dto.dependentRelationship,
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
      },
    });

    return insuredPatient;
  }

  async getPatients(
    insuranceId?: string,
    status?: string,
    search?: string,
    page: number = 1,
    limit: number = 10,
  ) {
    const prisma = this.prismaService.prisma;

    const where: any = {};
    if (insuranceId) where.insuranceId = insuranceId;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { policyNumber: { contains: search, mode: 'insensitive' } },
        { nationalId: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [patients, total] = await Promise.all([
      prisma.insuredPatient.findMany({
        where,
        include: {
          insurance: {
            select: {
              id: true,
              name: true,
              code: true,
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
          claims: {
            select: {
              id: true,
              status: true,
              totalAmount: true,
              claimedAt: true,
            },
            orderBy: { claimedAt: 'desc' },
            take: 5,
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.insuredPatient.count({ where }),
    ]);

    return {
      data: patients,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getPatientById(patientId: string) {
    const prisma = this.prismaService.prisma;

    const patient = await prisma.insuredPatient.findUnique({
      where: { id: patientId },
      include: {
        insurance: {
          select: {
            id: true,
            name: true,
            code: true,
            email: true,
            phone: true,
            defaultCoveragePercentage: true,
            defaultCopayPercentage: true,
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
        claims: {
          include: {
            medicine: {
              select: {
                tradeName: true,
                genericName: true,
              },
            },
            pharmacy: {
              select: {
                name: true,
              },
            },
          },
          orderBy: { claimedAt: 'desc' },
        },
      },
    });

    if (!patient) {
      throw new NotFoundException('Insured patient not found');
    }

    return patient;
  }

  async verifyPolicy(dto: VerifyPolicyDto) {
    const prisma = this.prismaService.prisma;

    const patient = await prisma.insuredPatient.findUnique({
      where: { policyNumber: dto.policyNumber },
      include: {
        insurance: {
          select: {
            id: true,
            name: true,
            code: true,
            status: true,
            isActive: true,
            defaultCoveragePercentage: true,
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
      },
    });

    if (!patient) {
      return {
        valid: false,
        message: 'Policy number not found',
      };
    }

    if (dto.nationalId && patient.nationalId !== dto.nationalId) {
      return {
        valid: false,
        message: 'National ID does not match',
      };
    }

    if (!patient.insurance.isActive || patient.insurance.status !== 'ACTIVE') {
      return {
        valid: false,
        message: 'Insurance provider is not active',
      };
    }

    if (patient.status !== 'ACTIVE') {
      return {
        valid: false,
        message: `Patient policy status is ${patient.status}`,
      };
    }

    const now = new Date();
    if (patient.endDate && patient.endDate < now) {
      return {
        valid: false,
        message: 'Policy has expired',
      };
    }

    if (patient.startDate > now) {
      return {
        valid: false,
        message: 'Policy has not started yet',
      };
    }

    return {
      valid: true,
      message: 'Policy is valid',
      patient: {
        id: patient.id,
        fullName: patient.fullName,
        policyNumber: patient.policyNumber,
        nationalId: patient.nationalId,
        coveragePercentage: patient.coveragePercentage || patient.insurance.defaultCoveragePercentage,
        startDate: patient.startDate,
        endDate: patient.endDate,
        insurance: {
          id: patient.insurance.id,
          name: patient.insurance.name,
          code: patient.insurance.code,
        },
      },
    };
  }

  async updatePatient(patientId: string, dto: Partial<RegisterInsuredPatientDto> & { status?: string }) {
    const prisma = this.prismaService.prisma;

    const patient = await prisma.insuredPatient.findUnique({
      where: { id: patientId },
    });

    if (!patient) {
      throw new NotFoundException('Insured patient not found');
    }

    if (dto.policyNumber && dto.policyNumber !== patient.policyNumber) {
      const existingPolicy = await prisma.insuredPatient.findUnique({
        where: { policyNumber: dto.policyNumber },
      });

      if (existingPolicy) {
        throw new BadRequestException('Policy number already exists');
      }
    }

    const updatedPatient = await prisma.insuredPatient.update({
      where: { id: patientId },
      data: {
        patientId: dto.patientId,
        policyNumber: dto.policyNumber,
        nationalId: dto.nationalId,
        fullName: dto.fullName,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        gender: dto.gender,
        phone: dto.phone,
        coveragePercentage: dto.coveragePercentage,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        dependentName: dto.dependentName,
        dependentRelationship: dto.dependentRelationship,
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
      },
    });

    return updatedPatient;
  }

  async searchByNationalId(nationalId: string) {
    const prisma = this.prismaService.prisma;

    const patients = await prisma.insuredPatient.findMany({
      where: { nationalId },
      include: {
        insurance: {
          select: {
            id: true,
            name: true,
            code: true,
            status: true,
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
              },
            },
          },
        },
      },
    });

    return patients;
  }
}
