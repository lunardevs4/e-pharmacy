import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { UserRole } from '@generated/prisma';
import {
  validatePositiveInt,
  validateWhitelist,
  ALLOWED_AUDIT_ENTITY_TYPES,
  ALLOWED_AUDIT_ACTIONS,
  validateUuid,
} from '../common/security/security.util';

interface AuthenticatedUser {
  id: string;
  role: UserRole;
}

export interface CreateAuditLogDto {
  userId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  changes?: Record<string, any> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  pharmacyId?: string | null;
}

@Injectable()
export class AuditLogsService {
  constructor(private prismaService: PrismaService) { }

  async log(dto: CreateAuditLogDto): Promise<void> {
    const prisma = this.prismaService.prisma;
    await prisma.auditLog.create({
      data: {
        userId: dto.userId ?? null,
        pharmacyId: dto.pharmacyId ?? null,
        action: dto.action,
        entityType: dto.entityType,
        entityId: dto.entityId ?? null,
        changes: dto.changes ?? undefined,
        ipAddress: dto.ipAddress ?? null,
        userAgent: dto.userAgent ?? null,
      },
    });
  }

  async findAll(
    user: AuthenticatedUser,
    page: number = 1,
    limit: number = 10,
    entityType?: string,
    action?: string,
  ) {
    const prisma = this.prismaService.prisma;
    const safePage = validatePositiveInt(page, 'page', 1);
    const safeLimit = validatePositiveInt(limit, 'limit', 10);
    const safeEntityType = entityType
      ? validateWhitelist(entityType, ALLOWED_AUDIT_ENTITY_TYPES, 'entityType')
      : undefined;
    const safeAction = action
      ? validateWhitelist(action, ALLOWED_AUDIT_ACTIONS, 'action')
      : undefined;

    const skip = (safePage - 1) * safeLimit;
    const where: any = {};
    if (safeEntityType) where.entityType = safeEntityType;
    if (safeAction) where.action = safeAction;

    if (user.role === UserRole.ADMIN) {
      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          skip,
          take: safeLimit,
          where,
          include: { user: { select: { firstName: true, lastName: true, email: true } } },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.auditLog.count({ where }),
      ]);

      return {
        data: logs,
        meta: { page: safePage, limit: safeLimit, total, totalPages: Math.ceil(total / safeLimit) },
      };
    }

    if (user.role === UserRole.GOVERNMENT) {
      const govtAllowedEntities = [
        'Pharmacy',
        'Medicine',
        'Reservation',
        'Inventory',
        'Prescription',
      ];
      const restrictedWhere: any = {
        ...where,
        entityType: { in: govtAllowedEntities },
      };

      const safeLimitCapped = Math.min(safeLimit, 25);
      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          skip,
          take: safeLimitCapped,
          where: restrictedWhere,
          include: { user: { select: { firstName: true, lastName: true, email: true } } },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.auditLog.count({ where: restrictedWhere }),
      ]);

      return {
        access: 'LIMITED',
        scope: 'Government allowed entities (Pharmacy, Medicine, Reservation, Inventory, Prescription)',
        data: logs,
        meta: {
          page: safePage,
          limit: safeLimitCapped,
          total,
          totalPages: Math.ceil(total / safeLimitCapped),
        },
      };
    }

    throw new ForbiddenException('Full audit logs access is restricted to ADMIN (full) and GOVERNMENT (limited) roles');
  }

  async findByPharmacy(user: AuthenticatedUser, pharmacyId: string, limit = 100) {
    const prisma = this.prismaService.prisma;
    const safePharmacyId = validateUuid(pharmacyId, 'pharmacyId');
    const pharmacy = await prisma.pharmacy.findUnique({ where: { id: safePharmacyId } });
    if (!pharmacy) throw new ForbiddenException('Pharmacy not found');
    if (user.role === UserRole.PHARMACY_OWNER && pharmacy.ownerId !== user.id) throw new ForbiddenException('You do not own this pharmacy');
    if (user.role === UserRole.PHARMACIST) {
      const employee = await prisma.pharmacyEmployee.findFirst({ where: { pharmacyId: safePharmacyId, userId: user.id, role: UserRole.PHARMACIST } });
      if (!employee) throw new ForbiddenException('You are not employed at this pharmacy');
    }
    const [reservations, inventory] = await Promise.all([
      prisma.reservation.findMany({ where: { pharmacyId: safePharmacyId }, select: { id: true } }),
      prisma.inventory.findMany({ where: { pharmacyId: safePharmacyId }, select: { id: true } }),
    ]);
    const entityIds = {
      reservation: reservations.map((item) => item.id),
      inventory: inventory.map((item) => item.id),
    };
    const where: any = {
      OR: [
        { pharmacyId: safePharmacyId },
        ...(entityIds.reservation.length > 0
          ? [{ entityType: 'Reservation', entityId: { in: entityIds.reservation } }]
          : []),
        ...(entityIds.inventory.length > 0
          ? [{ entityType: 'Inventory', entityId: { in: entityIds.inventory } }]
          : []),
      ],
    };
    return prisma.auditLog.findMany({ where, take: Math.min(Number(limit) || 100, 100), include: { user: { select: { firstName: true, lastName: true, email: true, role: true } } }, orderBy: { createdAt: 'desc' } });
  }
}
