import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateInventoryDto, UpdateInventoryDto } from './dto/inventory.dto';
import { validateUuid, sanitizeDeep, validateDate } from '../common/security/security.util';
import { UserRole } from '@generated/prisma';

interface AuthenticatedUser {
  id: string;
  role: UserRole;
}

@Injectable()
export class InventoryService {
  constructor(private prismaService: PrismaService) { }

  private async ensureViewAccess(pharmacyId: string, user: AuthenticatedUser) {
    const prisma = this.prismaService.prisma;
    const pharmacy = await prisma.pharmacy.findUnique({ where: { id: pharmacyId } });
    if (!pharmacy) throw new NotFoundException('Pharmacy not found');

    if (user.role === UserRole.ADMIN || user.role === UserRole.GOVERNMENT || user.role === UserRole.PATIENT) {
      return pharmacy;
    }

    if (user.role === UserRole.PHARMACY_OWNER) {
      if (pharmacy.ownerId !== user.id) {
        throw new ForbiddenException('You do not own this pharmacy');
      }
      return pharmacy;
    }

    if (user.role === UserRole.PHARMACIST) {
      const employee = await prisma.pharmacyEmployee.findFirst({
        where: {
          pharmacyId,
          userId: user.id,
          role: UserRole.PHARMACIST,
        },
      });
      if (!employee) {
        throw new ForbiddenException('You are not employed as a pharmacist at this pharmacy');
      }
      return pharmacy;
    }

    throw new ForbiddenException('Insufficient permissions to view this inventory');
  }

  private async ensureWriteAccess(pharmacyId: string, user: AuthenticatedUser) {
    const prisma = this.prismaService.prisma;
    const pharmacy = await prisma.pharmacy.findUnique({ where: { id: pharmacyId } });
    if (!pharmacy) throw new NotFoundException('Pharmacy not found');

    if (user.role !== UserRole.PHARMACIST) {
      throw new ForbiddenException('Only pharmacists can modify inventory');
    }

    const employee = await prisma.pharmacyEmployee.findFirst({
      where: {
        pharmacyId,
        userId: user.id,
        role: UserRole.PHARMACIST,
      },
    });
    if (!employee) {
      throw new ForbiddenException('You are not employed as a pharmacist at this pharmacy');
    }

    return pharmacy;
  }

  async create(pharmacyId: string, user: AuthenticatedUser, createInventoryDto: CreateInventoryDto) {
    const prisma = this.prismaService.prisma;
    const safePharmacyId = validateUuid(pharmacyId, 'pharmacyId');
    const safeUserId = validateUuid(user.id, 'userId');
    const safeDto = sanitizeDeep(createInventoryDto);

    await this.ensureWriteAccess(safePharmacyId, user);

    const expiryDate = validateDate((safeDto as any).expiryDate, 'expiryDate');
    const { expiryDate: _stripExpiry, ...restDto } = safeDto as any;

    const inventory = await prisma.inventory.create({
      data: {
        pharmacyId: safePharmacyId,
        ...restDto,
        ...(expiryDate ? { expiryDate } : {}),
      },
    });

    await prisma.inventoryHistory.create({
      data: {
        inventoryId: inventory.id,
        oldQuantity: 0,
        newQuantity: safeDto.quantity,
        oldPrice: null,
        newPrice: safeDto.price,
        changedBy: safeUserId,
      },
    });

    await prisma.stockMovement.create({
      data: {
        inventoryId: inventory.id,
        type: 'ADD',
        quantity: safeDto.quantity,
        reason: 'Initial stock',
        movedBy: safeUserId,
      },
    });

    return inventory;
  }

  async findByPharmacy(pharmacyId: string, user: AuthenticatedUser) {
    const prisma = this.prismaService.prisma;
    const safePharmacyId = validateUuid(pharmacyId, 'pharmacyId');

    await this.ensureViewAccess(safePharmacyId, user);

    return prisma.inventory.findMany({
      where: { pharmacyId: safePharmacyId, deletedAt: null },
      include: { medicine: true },
    });
  }

  async findOne(id: string, pharmacyId: string, user: AuthenticatedUser) {
    const prisma = this.prismaService.prisma;
    const safeId = validateUuid(id, 'id');
    const safePharmacyId = validateUuid(pharmacyId, 'pharmacyId');

    await this.ensureViewAccess(safePharmacyId, user);

    const inventory = await prisma.inventory.findUnique({
      where: { id: safeId },
      include: { medicine: true, inventoryHistory: true, stockMovements: true },
    });
    if (!inventory) throw new NotFoundException('Inventory not found');
    return inventory;
  }

  async update(id: string, pharmacyId: string, user: AuthenticatedUser, updateInventoryDto: UpdateInventoryDto) {
    const prisma = this.prismaService.prisma;
    const safeId = validateUuid(id, 'id');
    const safePharmacyId = validateUuid(pharmacyId, 'pharmacyId');
    const safeUserId = validateUuid(user.id, 'userId');
    const safeDto = sanitizeDeep(updateInventoryDto);

    await this.ensureWriteAccess(safePharmacyId, user);

    const inventory = await prisma.inventory.findUnique({ where: { id: safeId } });
    if (!inventory) throw new NotFoundException('Inventory not found');

    const expiryDate = (safeDto as any).expiryDate !== undefined
      ? validateDate((safeDto as any).expiryDate, 'expiryDate')
      : undefined;
    const { expiryDate: _stripExpiry, ...restDto } = safeDto as any;

    const updated = await prisma.inventory.update({
      where: { id: safeId },
      data: {
        ...restDto,
        ...(expiryDate !== undefined ? { expiryDate } : {}),
      },
    });

    if (safeDto.quantity !== undefined || safeDto.price !== undefined) {
      await prisma.inventoryHistory.create({
        data: {
          inventoryId: safeId,
          oldQuantity: inventory.quantity,
          newQuantity: safeDto.quantity ?? inventory.quantity,
          oldPrice: inventory.price,
          newPrice: safeDto.price ?? inventory.price,
          changedBy: safeUserId,
        },
      });
    }

    return updated;
  }

  async remove(id: string, pharmacyId: string, user: AuthenticatedUser) {
    const prisma = this.prismaService.prisma;
    const safeId = validateUuid(id, 'id');
    const safePharmacyId = validateUuid(pharmacyId, 'pharmacyId');

    await this.ensureWriteAccess(safePharmacyId, user);

    return prisma.inventory.update({ where: { id: safeId }, data: { deletedAt: new Date() } });
  }
}
