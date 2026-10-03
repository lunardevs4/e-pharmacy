import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@generated/prisma';

export interface AuthenticatedTenantUser {
  id: string;
  role: UserRole;
}

@Injectable()
export class TenantService {
  constructor(private prismaService: PrismaService) {}

  /**
   * Validates if an authenticated user has tenant authorization for a given pharmacy.
   * - Owner must own the pharmacy (`pharmacy.ownerId === user.id`).
   * - Employee/Pharmacist must have a valid `PharmacyEmployee` record (`pharmacyId` and `userId`).
   * - ADMIN / GOVERNMENT can access if allowed.
   */
  async validatePharmacyAccess(
    pharmacyId: string,
    user: AuthenticatedTenantUser,
    options: {
      allowAdmin?: boolean;
      allowGovernment?: boolean;
      allowPatient?: boolean;
      requireOwnerOnly?: boolean;
    } = {},
  ) {
    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    const {
      allowAdmin = true,
      allowGovernment = false,
      allowPatient = false,
      requireOwnerOnly = false,
    } = options;

    if (allowAdmin && user.role === UserRole.ADMIN) {
      return true;
    }

    if (allowGovernment && user.role === UserRole.GOVERNMENT) {
      return true;
    }

    if (allowPatient && user.role === UserRole.PATIENT) {
      return true;
    }

    const prisma = this.prismaService.prisma;
    const pharmacy = await prisma.pharmacy.findUnique({
      where: { id: pharmacyId },
      select: { id: true, ownerId: true, deletedAt: true },
    });

    if (!pharmacy || pharmacy.deletedAt) {
      throw new NotFoundException('Pharmacy not found');
    }

    // Owner check
    if (pharmacy.ownerId === user.id) {
      return true;
    }

    if (requireOwnerOnly) {
      throw new ForbiddenException(
        'You do not have owner privileges for this pharmacy',
      );
    }

    // Employee / Pharmacist / Pharmacy role check via PharmacyEmployee relationship
    const employee = await prisma.pharmacyEmployee.findUnique({
      where: {
        pharmacyId_userId: {
          pharmacyId,
          userId: user.id,
        },
      },
    });

    if (employee) {
      return true;
    }

    throw new ForbiddenException(
      'You are not authorized to access this pharmacy tenant',
    );
  }
}
