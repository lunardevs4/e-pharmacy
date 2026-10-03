import { Test, TestingModule } from '@nestjs/testing';
import { TenantService } from './tenant.service';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@generated/prisma';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

describe('TenantService (Security & Tenant Isolation)', () => {
  let tenantService: TenantService;
  let prismaService: any;

  const pharmacyIdA = '550e8400-e29b-41d4-a716-446655440001';
  const ownerUserA = { id: 'user-owner-a', role: UserRole.PHARMACY_OWNER };
  const ownerUserB = { id: 'user-owner-b', role: UserRole.PHARMACY_OWNER };
  const pharmacistUserA = { id: 'user-pharm-a', role: UserRole.PHARMACIST };
  const adminUser = { id: 'user-admin', role: UserRole.ADMIN };

  beforeEach(async () => {
    prismaService = {
      prisma: {
        pharmacy: {
          findUnique: jest.fn(),
        },
        pharmacyEmployee: {
          findUnique: jest.fn(),
        },
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantService,
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    tenantService = module.get<TenantService>(TenantService);
  });

  it('should allow pharmacy owner accessing their own pharmacy', async () => {
    prismaService.prisma.pharmacy.findUnique.mockResolvedValue({
      id: pharmacyIdA,
      ownerId: ownerUserA.id,
      deletedAt: null,
    });

    const result = await tenantService.validatePharmacyAccess(pharmacyIdA, ownerUserA);
    expect(result).toBe(true);
  });

  it('should REJECT pharmacy owner attempting to access another pharmacy (BOLA/IDOR)', async () => {
    prismaService.prisma.pharmacy.findUnique.mockResolvedValue({
      id: pharmacyIdA,
      ownerId: ownerUserA.id,
      deletedAt: null,
    });
    prismaService.prisma.pharmacyEmployee.findUnique.mockResolvedValue(null);

    await expect(
      tenantService.validatePharmacyAccess(pharmacyIdA, ownerUserB),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should allow employed pharmacist to access their pharmacy', async () => {
    prismaService.prisma.pharmacy.findUnique.mockResolvedValue({
      id: pharmacyIdA,
      ownerId: ownerUserA.id,
      deletedAt: null,
    });
    prismaService.prisma.pharmacyEmployee.findUnique.mockResolvedValue({
      pharmacyId: pharmacyIdA,
      userId: pharmacistUserA.id,
    });

    const result = await tenantService.validatePharmacyAccess(pharmacyIdA, pharmacistUserA);
    expect(result).toBe(true);
  });

  it('should allow ADMIN role when allowAdmin is true', async () => {
    const result = await tenantService.validatePharmacyAccess(pharmacyIdA, adminUser, {
      allowAdmin: true,
    });
    expect(result).toBe(true);
  });

  it('should throw NotFoundException if pharmacy does not exist', async () => {
    prismaService.prisma.pharmacy.findUnique.mockResolvedValue(null);

    await expect(
      tenantService.validatePharmacyAccess('non-existent-id', ownerUserA),
    ).rejects.toThrow(NotFoundException);
  });
});
