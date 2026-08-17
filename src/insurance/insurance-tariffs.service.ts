import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { SetMedicineTariffDto, BatchUpdateTariffDto } from './dto/insurance.dto';

@Injectable()
export class InsuranceTariffsService {
  constructor(private prismaService: PrismaService) {}

  async setTariff(dto: SetMedicineTariffDto) {
    const prisma = this.prismaService.prisma;

    // Verify insurance exists
    const insurance = await prisma.insuranceProvider.findUnique({
      where: { id: dto.insuranceId },
    });

    if (!insurance) {
      throw new NotFoundException('Insurance provider not found');
    }

    // Verify medicine exists
    const medicine = await prisma.medicine.findUnique({
      where: { id: dto.medicineId },
    });

    if (!medicine) {
      throw new NotFoundException('Medicine not found');
    }

    // Check if tariff already exists
    const existingTariff = await prisma.insuranceMedicineTariff.findUnique({
      where: {
        insuranceId_medicineId: {
          insuranceId: dto.insuranceId,
          medicineId: dto.medicineId,
        },
      },
    });

    if (existingTariff) {
      // Update existing tariff
      const updatedTariff = await prisma.insuranceMedicineTariff.update({
        where: { id: existingTariff.id },
        data: {
          coveredPrice: dto.coveredPrice,
          coveragePercentage: dto.coveragePercentage ?? insurance.defaultCoveragePercentage,
          copayPercentage: dto.copayPercentage ?? insurance.defaultCopayPercentage,
          fixedCopayAmount: dto.fixedCopayAmount,
          isCovered: dto.isCovered ?? true,
          requiresPreAuth: dto.requiresPreAuth ?? false,
          effectiveDate: dto.effectiveDate ? new Date(dto.effectiveDate) : new Date(),
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
          medicine: {
            select: {
              id: true,
              tradeName: true,
              genericName: true,
            },
          },
        },
      });

      return updatedTariff;
    }

    // Create new tariff
    const tariff = await prisma.insuranceMedicineTariff.create({
      data: {
        insuranceId: dto.insuranceId,
        medicineId: dto.medicineId,
        coveredPrice: dto.coveredPrice,
        coveragePercentage: dto.coveragePercentage ?? insurance.defaultCoveragePercentage,
        copayPercentage: dto.copayPercentage ?? insurance.defaultCopayPercentage,
        fixedCopayAmount: dto.fixedCopayAmount,
        isCovered: dto.isCovered ?? true,
        requiresPreAuth: dto.requiresPreAuth ?? false,
        effectiveDate: dto.effectiveDate ? new Date(dto.effectiveDate) : new Date(),
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
        medicine: {
          select: {
            id: true,
            tradeName: true,
            genericName: true,
          },
        },
      },
    });

    return tariff;
  }

  async batchUpdateTariffs(dto: BatchUpdateTariffDto) {
    const results = [];

    for (const tariffDto of dto.tariffs) {
      try {
        const tariff = await this.setTariff({
          ...tariffDto,
          insuranceId: dto.insuranceId,
        });
        results.push({ success: true, tariff });
      } catch (error: any) {
        results.push({ success: false, error: error.message, medicineId: tariffDto.medicineId });
      }
    }

    return {
      total: dto.tariffs.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
    };
  }

  async getTariffs(insuranceId?: string, medicineId?: string, status?: string) {
    const prisma = this.prismaService.prisma;

    const where: any = {};
    if (insuranceId) where.insuranceId = insuranceId;
    if (medicineId) where.medicineId = medicineId;
    if (status) where.status = status;

    const tariffs = await prisma.insuranceMedicineTariff.findMany({
      where,
      include: {
        insurance: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        medicine: {
          select: {
            id: true,
            tradeName: true,
            genericName: true,
            category: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { effectiveDate: 'desc' },
    });

    return tariffs;
  }

  async getTariffById(tariffId: string) {
    const prisma = this.prismaService.prisma;

    const tariff = await prisma.insuranceMedicineTariff.findUnique({
      where: { id: tariffId },
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
        medicine: {
          select: {
            id: true,
            tradeName: true,
            genericName: true,
            category: {
              select: {
                id: true,
                name: true,
              },
            },
            manufacturer: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!tariff) {
      throw new NotFoundException('Tariff not found');
    }

    return tariff;
  }

  async updateTariff(tariffId: string, dto: Partial<SetMedicineTariffDto> & { status?: string }) {
    const prisma = this.prismaService.prisma;

    const tariff = await prisma.insuranceMedicineTariff.findUnique({
      where: { id: tariffId },
    });

    if (!tariff) {
      throw new NotFoundException('Tariff not found');
    }

    const updatedTariff = await prisma.insuranceMedicineTariff.update({
      where: { id: tariffId },
      data: {
        coveredPrice: dto.coveredPrice,
        coveragePercentage: dto.coveragePercentage,
        copayPercentage: dto.copayPercentage,
        fixedCopayAmount: dto.fixedCopayAmount,
        isCovered: dto.isCovered,
        requiresPreAuth: dto.requiresPreAuth,
        effectiveDate: dto.effectiveDate ? new Date(dto.effectiveDate) : undefined,
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
        medicine: {
          select: {
            id: true,
            tradeName: true,
            genericName: true,
          },
        },
      },
    });

    return updatedTariff;
  }

  async deleteTariff(tariffId: string) {
    const prisma = this.prismaService.prisma;

    const tariff = await prisma.insuranceMedicineTariff.findUnique({
      where: { id: tariffId },
    });

    if (!tariff) {
      throw new NotFoundException('Tariff not found');
    }

    await prisma.insuranceMedicineTariff.delete({
      where: { id: tariffId },
    });

    return { message: 'Tariff deleted successfully' };
  }

  async calculateCopay(insuranceId: string, medicineId: string, retailPrice: number) {
    const prisma = this.prismaService.prisma;

    const tariff = await prisma.insuranceMedicineTariff.findUnique({
      where: {
        insuranceId_medicineId: {
          insuranceId,
          medicineId,
        },
      },
      include: {
        insurance: true,
      },
    });

    if (!tariff || !tariff.isCovered || tariff.status !== 'ACTIVE') {
      return {
        isCovered: false,
        insurancePays: 0,
        patientPays: retailPrice,
        coveragePercentage: 0,
        copayPercentage: 100,
      };
    }

    let insurancePays: number;
    let patientPays: number;

    if (tariff.fixedCopayAmount) {
      // Fixed copay amount
      insurancePays = Math.min(retailPrice, retailPrice - Number(tariff.fixedCopayAmount));
      patientPays = Number(tariff.fixedCopayAmount);
    } else {
      // Percentage-based copay
      const coverageRate = Number(tariff.coveragePercentage) / 100;
      insurancePays = retailPrice * coverageRate;
      patientPays = retailPrice - insurancePays;
    }

    return {
      isCovered: true,
      insurancePays: Math.round(insurancePays * 100) / 100,
      patientPays: Math.round(patientPays * 100) / 100,
      coveragePercentage: Number(tariff.coveragePercentage),
      copayPercentage: Number(tariff.copayPercentage),
      requiresPreAuth: tariff.requiresPreAuth,
      coveredPrice: Number(tariff.coveredPrice),
    };
  }
}
