import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

export interface MedicineCalculationInput {
  medicineId: string;
  quantity: number;
  unitPrice: number;
}

export interface MedicineCalculationResult {
  medicineId: string;
  medicineName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  isCovered: boolean;
  hasAgreement: boolean;
  insurancePays: number;
  patientPays: number;
  coveragePercentage: number;
  copayPercentage: number;
  requiresPreAuth: boolean;
  coveredPrice?: number;
  insuranceName?: string;
  insuranceCode?: string;
  insuranceId?: string;
  message?: string;
}

export interface CalculationInput {
  pharmacyId: string;
  insuranceId: string;
  medicines: MedicineCalculationInput[];
  patientId?: string;
  insuredPatientId?: string;
}

export interface CalculationResult {
  pharmacyId: string;
  insuranceId: string;
  insurance: {
    id: string;
    name: string;
    code: string;
  };
  coverage: {
    percentage: number;
    copayPercentage: number;
  };
  medicines: MedicineCalculationResult[];
  summary: {
    totalMedicineCost: number;
    totalInsuranceContribution: number;
    totalPatientContribution: number;
    medicineCount: number;
    coveredMedicineCount: number;
  };
}

@Injectable()
export class InsuranceCalculationService {
  constructor(private prismaService: PrismaService) {}

  async calculatePayments(input: CalculationInput): Promise<CalculationResult> {
    const prisma = this.prismaService.prisma;

    const pharmacy = await prisma.pharmacy.findUnique({
      where: { id: input.pharmacyId },
    });

    if (!pharmacy) {
      throw new NotFoundException('Pharmacy not found');
    }

    const insurance = await prisma.insuranceProvider.findUnique({
      where: { id: input.insuranceId },
    });

    if (!insurance) {
      throw new NotFoundException('Insurance provider not found');
    }

    if (!insurance.isActive || insurance.status !== 'ACTIVE') {
      throw new BadRequestException('Insurance provider is not active');
    }

    const defaultCoverage = Number(insurance.defaultCoveragePercentage || 0);

    const agreement = await prisma.pharmacyInsuranceAgreement.findUnique({
      where: {
        insuranceId_pharmacyId: {
          insuranceId: input.insuranceId,
          pharmacyId: input.pharmacyId,
        },
      },
    });

    if (!agreement || agreement.status !== 'ACTIVE') {
      throw new BadRequestException('No active agreement between pharmacy and insurance provider');
    }

    let patientCoverage: number | null = null;
    if (input.patientId || input.insuredPatientId) {
      const patient = await prisma.insuredPatient.findFirst({
        where: {
          id: input.insuredPatientId || undefined,
          patientId: input.patientId || undefined,
          insuranceId: input.insuranceId,
          status: 'ACTIVE',
        },
      });

      if (patient) {
        const now = new Date();
        if (patient.endDate && patient.endDate < now) {
          throw new BadRequestException('Patient insurance policy has expired');
        }
        if (patient.startDate > now) {
          throw new BadRequestException('Patient insurance policy has not started yet');
        }
        patientCoverage = patient.coveragePercentage ? Number(patient.coveragePercentage) : null;
      } else if (input.insuredPatientId) {
        throw new BadRequestException('Patient does not have an active policy with this insurance provider');
      }
    }

    const medicineResults: MedicineCalculationResult[] = [];
    let totalMedicineCost = 0;
    let totalInsuranceContribution = 0;
    let totalPatientContribution = 0;
    let coveredMedicineCount = 0;

    for (const medicineInput of input.medicines) {
      const result = await this.calculateMedicinePayment(
        medicineInput,
        input.pharmacyId,
        input.insuranceId,
        agreement.customCoverageRate ? Number(agreement.customCoverageRate) : null,
        patientCoverage,
        defaultCoverage,
        prisma,
      );

      medicineResults.push(result);
      totalMedicineCost += result.totalAmount;
      totalInsuranceContribution += result.insurancePays;
      totalPatientContribution += result.patientPays;
      if (result.isCovered) {
        coveredMedicineCount++;
      }
    }

    return {
      pharmacyId: input.pharmacyId,
      insuranceId: input.insuranceId,
      insurance: {
        id: insurance.id,
        name: insurance.name,
        code: insurance.code,
      },
      coverage: {
        percentage: Number(insurance.defaultCoveragePercentage || 0),
        copayPercentage: Number(insurance.defaultCopayPercentage || 0),
      },
      medicines: medicineResults,
      summary: {
        totalMedicineCost: Math.round(totalMedicineCost * 100) / 100,
        totalInsuranceContribution: Math.round(totalInsuranceContribution * 100) / 100,
        totalPatientContribution: Math.round(totalPatientContribution * 100) / 100,
        medicineCount: input.medicines.length,
        coveredMedicineCount,
      },
    };
  }

  private async calculateMedicinePayment(
    input: MedicineCalculationInput,
    pharmacyId: string,
    insuranceId: string,
    agreementCustomCoverage: number | null,
    patientCoverage: number | null,
    defaultCoverage: number,
    prisma: any,
  ): Promise<MedicineCalculationResult> {
    const medicine = await prisma.medicine.findUnique({
      where: { id: input.medicineId },
      select: {
        id: true,
        tradeName: true,
        genericName: true,
      },
    });

    if (!medicine) {
      throw new NotFoundException(`Medicine with ID ${input.medicineId} not found`);
    }

    const totalAmount = input.unitPrice * input.quantity;

    const tariff = await prisma.insuranceMedicineTariff.findUnique({
      where: {
        insuranceId_medicineId: {
          insuranceId,
          medicineId: input.medicineId,
        },
      },
    });

    let coveragePercentage = defaultCoverage;

    if (patientCoverage !== null) {
      coveragePercentage = patientCoverage;
    }
    else if (agreementCustomCoverage !== null) {
      coveragePercentage = Number(agreementCustomCoverage);
    }
    else if (tariff && tariff.coveragePercentage !== null) {
      coveragePercentage = Number(tariff.coveragePercentage);
    }

    if (!tariff || !tariff.isCovered || tariff.status !== 'ACTIVE') {
      return {
        medicineId: input.medicineId,
        medicineName: medicine.tradeName || medicine.genericName || 'Unknown',
        quantity: input.quantity,
        unitPrice: input.unitPrice,
        totalAmount,
        isCovered: false,
        hasAgreement: true,
        insurancePays: 0,
        patientPays: totalAmount,
        coveragePercentage: 0,
        copayPercentage: 100,
        requiresPreAuth: false,
        message: 'Medicine not covered by insurance tariff',
      };
    }

    let insurancePays: number;
    let patientPays: number;

    if (tariff.fixedCopayAmount) {
      insurancePays = Math.max(0, totalAmount - Number(tariff.fixedCopayAmount));
      patientPays = Number(tariff.fixedCopayAmount);
    } else {
      insurancePays = totalAmount * (coveragePercentage / 100);
      patientPays = totalAmount - insurancePays;
    }

    return {
      medicineId: input.medicineId,
      medicineName: medicine.tradeName || medicine.genericName || 'Unknown',
      quantity: input.quantity,
      unitPrice: input.unitPrice,
      totalAmount,
      isCovered: true,
      hasAgreement: true,
      insurancePays: Math.round(insurancePays * 100) / 100,
      patientPays: Math.round(patientPays * 100) / 100,
      coveragePercentage,
      copayPercentage: 100 - coveragePercentage,
      requiresPreAuth: tariff.requiresPreAuth || false,
      coveredPrice: Number(tariff.coveredPrice),
      insuranceId,
      insuranceName: undefined, // Will be filled by caller
      insuranceCode: undefined, // Will be filled by caller
    };
  }

  async getMedicineCoverage(
    pharmacyId: string,
    insuranceId: string,
    medicineId: string,
    retailPrice: number,
  ) {
    const prisma = this.prismaService.prisma;

    const agreement = await prisma.pharmacyInsuranceAgreement.findUnique({
      where: {
        insuranceId_pharmacyId: {
          insuranceId,
          pharmacyId,
        },
      },
      include: {
        insurance: {
          select: {
            id: true,
            name: true,
            code: true,
            defaultCoveragePercentage: true,
          },
        },
      },
    });

    if (!agreement || agreement.status !== 'ACTIVE') {
      return {
        isCovered: false,
        hasAgreement: false,
        insurancePays: 0,
        patientPays: retailPrice,
        coveragePercentage: 0,
        copayPercentage: 100,
        message: 'No active agreement between pharmacy and insurance',
      };
    }

    const tariff = await prisma.insuranceMedicineTariff.findUnique({
      where: {
        insuranceId_medicineId: {
          insuranceId,
          medicineId,
        },
      },
    });

    if (!tariff || !tariff.isCovered || tariff.status !== 'ACTIVE') {
      return {
        isCovered: false,
        hasAgreement: true,
        insurancePays: 0,
        patientPays: retailPrice,
        coveragePercentage: 0,
        copayPercentage: 100,
        message: 'Medicine not covered by insurance tariff',
        insuranceName: agreement.insurance.name,
        insuranceCode: agreement.insurance.code,
      };
    }

    const coveragePercentage = agreement.customCoverageRate
      ? Number(agreement.customCoverageRate)
      : Number(tariff.coveragePercentage);

    let insurancePays: number;
    let patientPays: number;

    if (tariff.fixedCopayAmount) {
      insurancePays = Math.max(0, retailPrice - Number(tariff.fixedCopayAmount));
      patientPays = Number(tariff.fixedCopayAmount);
    } else {
      insurancePays = retailPrice * (coveragePercentage / 100);
      patientPays = retailPrice - insurancePays;
    }

    return {
      isCovered: true,
      hasAgreement: true,
      insurancePays: Math.round(insurancePays * 100) / 100,
      patientPays: Math.round(patientPays * 100) / 100,
      coveragePercentage,
      copayPercentage: 100 - coveragePercentage,
      requiresPreAuth: tariff.requiresPreAuth,
      coveredPrice: Number(tariff.coveredPrice),
      insuranceName: agreement.insurance.name,
      insuranceCode: agreement.insurance.code,
      insuranceId: agreement.insurance.id,
    };
  }

  async validatePatientInsurance(
    patientId: string,
    insuranceId: string,
  ): Promise<{ valid: boolean; patient?: any; message?: string }> {
    const prisma = this.prismaService.prisma;

    const patient = await prisma.insuredPatient.findFirst({
      where: {
        patientId,
        insuranceId,
        status: 'ACTIVE',
      },
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
      },
    });

    if (!patient) {
      return {
        valid: false,
        message: 'Patient does not have an active policy with this insurance provider',
      };
    }

    if (!patient.insurance.isActive || patient.insurance.status !== 'ACTIVE') {
      return {
        valid: false,
        message: 'Insurance provider is not active',
      };
    }

    const now = new Date();
    if (patient.endDate && patient.endDate < now) {
      return {
        valid: false,
        message: 'Patient insurance policy has expired',
      };
    }

    if (patient.startDate > now) {
      return {
        valid: false,
        message: 'Patient insurance policy has not started yet',
      };
    }

    return {
      valid: true,
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
}
