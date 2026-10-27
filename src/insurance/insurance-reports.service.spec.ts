import { Test, TestingModule } from '@nestjs/testing';
import { InsuranceReportsService } from './insurance-reports.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import { Writable } from 'stream';

describe('InsuranceReportsService', () => {
  let service: InsuranceReportsService;
  let mockPrisma: any;

  const mockResponse = () => {
    const stream = new Writable({
      write(chunk, encoding, callback) {
        callback();
      },
    });
    (stream as any).setHeader = jest.fn();
    (stream as any).send = jest.fn();
    return stream as unknown as Response;
  };

  beforeEach(async () => {
    mockPrisma = {
      insuranceProvider: {
        findUnique: jest.fn(),
      },
      insuranceClaim: {
        findMany: jest.fn(),
      },
      insuredPatient: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InsuranceReportsService,
        {
          provide: PrismaService,
          useValue: { prisma: mockPrisma },
        },
      ],
    }).compile();

    service = module.get<InsuranceReportsService>(InsuranceReportsService);
  });

  describe('generateRejectionAnalysis', () => {
    it('throws NotFoundException if insurance provider does not exist', async () => {
      mockPrisma.insuranceProvider.findUnique.mockResolvedValue(null);
      const res = mockResponse();

      await expect(service.generateRejectionAnalysis('non-existent-id', res)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('sets proper PDF headers when provider exists', async () => {
      mockPrisma.insuranceProvider.findUnique.mockResolvedValue({
        id: 'rssb-id',
        name: 'RSSB Medical',
        code: 'RSSB',
      });
      mockPrisma.insuranceClaim.findMany.mockResolvedValue([
        {
          claimNumber: 'CLM-001',
          status: 'REJECTED',
          totalAmount: 5000,
          rejectionReason: 'Policy expired',
          claimedAt: new Date(),
          pharmacy: { name: 'Kigali Pharmacy' },
          medicine: { tradeName: 'Amoxicillin' },
        },
      ]);

      const res = mockResponse();
      await service.generateRejectionAnalysis('rssb-id', res);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="RSSB_rejection_analysis.pdf"',
      );
    });
  });

  describe('generateCoverageAudit', () => {
    it('throws NotFoundException if insurance provider does not exist', async () => {
      mockPrisma.insuranceProvider.findUnique.mockResolvedValue(null);
      const res = mockResponse();

      await expect(service.generateCoverageAudit('non-existent-id', res)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('exports CSV with insured patients data and sets CSV headers', async () => {
      mockPrisma.insuranceProvider.findUnique.mockResolvedValue({
        id: 'rssb-id',
        name: 'RSSB Medical',
        code: 'RSSB',
        defaultCoveragePercentage: 85,
      });
      mockPrisma.insuredPatient.findMany.mockResolvedValue([
        {
          policyNumber: 'RSSB-12345',
          nationalId: '1199080012345678',
          fullName: 'Aline Umutoni',
          gender: 'Female',
          phone: '+250788123456',
          coveragePercentage: 85,
          status: 'ACTIVE',
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
        },
      ]);

      const res = mockResponse();
      await service.generateCoverageAudit('rssb-id', res);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="RSSB_coverage_audit.csv"',
      );
      expect(res.send).toHaveBeenCalled();
    });
  });
});
