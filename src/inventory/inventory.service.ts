import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateInventoryDto, UpdateInventoryDto } from './dto/inventory.dto';
import {
  validateUuid,
  sanitizeDeep,
  validateDate,
  validateSafeString,
  validatePositiveInt,
} from '../common/security/security.util';
import { UserRole } from '@generated/prisma';
import csv from 'csv-parser';
import * as xlsx from 'xlsx';
import { Readable } from 'stream';
import { EmailService } from '../common/email/email.service';
import { ApiCacheService } from '../common/cache/api-cache.service';

interface AuthenticatedUser {
  id: string;
  role: UserRole;
}

@Injectable()
export class InventoryService {
  constructor(
    private prismaService: PrismaService,
    private emailService: EmailService,
    private apiCache: ApiCacheService,
  ) { }

  private async ensureViewAccess(pharmacyId: string, user: AuthenticatedUser) {
    const prisma = this.prismaService.prisma;
    const pharmacy = await prisma.pharmacy.findUnique({
      where: { id: pharmacyId },
    });
    if (!pharmacy) throw new NotFoundException('Pharmacy not found');

    if (
      user.role === UserRole.ADMIN ||
      user.role === UserRole.GOVERNMENT ||
      user.role === UserRole.PATIENT
    ) {
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
        throw new ForbiddenException(
          'You are not employed as a pharmacist at this pharmacy',
        );
      }
      return pharmacy;
    }

    throw new ForbiddenException(
      'Insufficient permissions to view this inventory',
    );
  }

  private async ensureWriteAccess(pharmacyId: string, user: AuthenticatedUser) {
    const prisma = this.prismaService.prisma;
    const pharmacy = await prisma.pharmacy.findUnique({
      where: { id: pharmacyId },
    });
    if (!pharmacy) throw new NotFoundException('Pharmacy not found');

    if (user.role === UserRole.ADMIN) return pharmacy;

    if (
      user.role === UserRole.PHARMACY_OWNER ||
      (user.role as string) === 'PHARMACY'
    ) {
      if (pharmacy.ownerId !== user.id) {
        throw new ForbiddenException('You do not own this pharmacy');
      }
      return pharmacy;
    }

    if (user.role === UserRole.PHARMACIST) {
      const employee = await prisma.pharmacyEmployee.findFirst({
        where: { pharmacyId, userId: user.id },
      });
      if (!employee) {
        throw new ForbiddenException('You are not employed at this pharmacy');
      }
      return pharmacy;
    }

    throw new ForbiddenException(
      'Insufficient permissions to modify this inventory',
    );
  }

  async create(
    pharmacyId: string,
    user: AuthenticatedUser,
    createInventoryDto: CreateInventoryDto,
  ) {
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

    this.apiCache.invalidate('medicine:availability:');
    this.apiCache.invalidate('search:');
    return inventory;
  }

  async findByPharmacy(pharmacyId: string, user: AuthenticatedUser) {
    const prisma = this.prismaService.prisma;
    const safePharmacyId = validateUuid(pharmacyId, 'pharmacyId');

    await this.ensureViewAccess(safePharmacyId, user);

    return prisma.inventory.findMany({
      where: { pharmacyId: safePharmacyId, deletedAt: null },
      include: {
        medicine: {
          include: { category: true, manufacturer: true, batches: true },
        },
      },
    });
  }

  async findOne(id: string, pharmacyId: string, user: AuthenticatedUser) {
    const prisma = this.prismaService.prisma;
    const safeId = validateUuid(id, 'id');
    const safePharmacyId = validateUuid(pharmacyId, 'pharmacyId');

    await this.ensureViewAccess(safePharmacyId, user);

    const inventory = await prisma.inventory.findUnique({
      where: { id: safeId },
      include: {
        medicine: {
          include: { category: true, manufacturer: true, batches: true },
        },
        inventoryHistory: true,
        stockMovements: true,
      },
    });
    if (!inventory) throw new NotFoundException('Inventory not found');
    return inventory;
  }

  async update(
    id: string,
    pharmacyId: string,
    user: AuthenticatedUser,
    updateInventoryDto: UpdateInventoryDto,
  ) {
    const prisma = this.prismaService.prisma;
    const safeId = validateUuid(id, 'id');
    const safePharmacyId = validateUuid(pharmacyId, 'pharmacyId');
    const safeUserId = validateUuid(user.id, 'userId');
    const safeDto = sanitizeDeep(updateInventoryDto);

    await this.ensureWriteAccess(safePharmacyId, user);

    const inventory = await prisma.inventory.findUnique({
      where: { id: safeId },
    });
    if (!inventory) throw new NotFoundException('Inventory not found');

    const expiryDate =
      (safeDto as any).expiryDate !== undefined
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

    const newQuantity = safeDto.quantity ?? inventory.quantity;
    if (inventory.quantity >= 10 && newQuantity < 10) {
      const details = await prisma.inventory.findUnique({
        where: { id: safeId },
        include: { medicine: true, pharmacy: { include: { owner: true } } },
      });
      const owner = details?.pharmacy.owner;
      if (owner) {
        const setting = await prisma.systemSetting.findUnique({
          where: { key: `email_notifications:${owner.id}` },
        });
        const emailEnabled = setting
          ? JSON.parse(setting.value).lowStock !== false
          : true;
        const message = `${details.medicine.tradeName} at ${details.pharmacy.name} is low on stock (${newQuantity} units remaining).`;
        await prisma.notification.create({
          data: {
            userId: owner.id,
            type: 'IN_APP',
            title: 'Low Stock Alert',
            message,
          },
        });
        if (emailEnabled) {
          await this.emailService.sendNotificationEmail(
            owner.email,
            `${owner.firstName} ${owner.lastName}`.trim(),
            'Low Stock Alert',
            message,
          );
        }
      }
    }

    this.apiCache.invalidate('medicine:availability:');
    this.apiCache.invalidate('search:');
    return updated;
  }

  async remove(id: string, pharmacyId: string, user: AuthenticatedUser) {
    const prisma = this.prismaService.prisma;
    const safeId = validateUuid(id, 'id');
    const safePharmacyId = validateUuid(pharmacyId, 'pharmacyId');

    await this.ensureWriteAccess(safePharmacyId, user);

    const result = await prisma.inventory.update({
      where: { id: safeId },
      data: { deletedAt: new Date() },
    });
    this.apiCache.invalidate('medicine:availability:');
    this.apiCache.invalidate('search:');
    return result;
  }

  private normalizeRow(row: Record<string, any>): Record<string, any> {
    const normalized: Record<string, any> = {};
    for (const key of Object.keys(row)) {
      const cleanKey = key.trim().toLowerCase().replace(/[\s\-_]+/g, '');
      normalized[cleanKey] = row[key];
    }

    const tradeName =
      normalized.tradename ||
      normalized.trade ||
      normalized.name ||
      normalized.medicinename ||
      normalized.medicine;
    const genericName =
      normalized.genericname ||
      normalized.generic ||
      normalized.activeingredient;
    const quantity =
      normalized.quantity ||
      normalized.qty ||
      normalized.stock ||
      normalized.count;
    const price =
      normalized.price ||
      normalized.unitprice ||
      normalized.sellingprice ||
      normalized.rate;
    const category = normalized.category || normalized.categoryname;
    const manufacturer =
      normalized.manufacturer ||
      normalized.manufacturername ||
      normalized.brand;
    const batchNumber =
      normalized.batchnumber || normalized.batchno || normalized.batch;
    const lotNumber =
      normalized.lotnumber || normalized.lotno || normalized.lot;
    const expiryDate =
      normalized.expirydate ||
      normalized.expdate ||
      normalized.expiry ||
      normalized.expiration;
    const unitCost =
      normalized.unitcost || normalized.costprice || normalized.cost;

    return {
      tradeName:
        tradeName !== undefined && tradeName !== null
          ? String(tradeName).trim()
          : undefined,
      genericName:
        genericName !== undefined && genericName !== null
          ? String(genericName).trim()
          : undefined,
      quantity:
        quantity !== undefined && quantity !== null
          ? String(quantity).trim()
          : undefined,
      price:
        price !== undefined && price !== null
          ? String(price).trim()
          : undefined,
      category:
        category !== undefined && category !== null
          ? String(category).trim()
          : undefined,
      manufacturer:
        manufacturer !== undefined && manufacturer !== null
          ? String(manufacturer).trim()
          : undefined,
      batchNumber:
        batchNumber !== undefined && batchNumber !== null
          ? String(batchNumber).trim()
          : undefined,
      lotNumber:
        lotNumber !== undefined && lotNumber !== null
          ? String(lotNumber).trim()
          : undefined,
      expiryDate:
        expiryDate !== undefined && expiryDate !== null
          ? String(expiryDate).trim()
          : undefined,
      unitCost:
        unitCost !== undefined && unitCost !== null
          ? String(unitCost).trim()
          : undefined,
    };
  }

  async importInventory(
    pharmacyId: string,
    user: AuthenticatedUser,
    fileBuffer: Buffer,
    mimeType: string,
    originalName?: string,
  ) {
    const prisma = this.prismaService.prisma;
    const safePharmacyId = validateUuid(pharmacyId, 'pharmacyId');
    const safeUserId = validateUuid(user.id, 'userId');

    await this.ensureWriteAccess(safePharmacyId, user);

    let rows: any[] = [];
    const lowerName = (originalName || '').toLowerCase();
    const isCsv =
      mimeType.includes('csv') ||
      mimeType === 'text/plain' ||
      mimeType === 'application/vnd.ms-excel' ||
      lowerName.endsWith('.csv');

    if (isCsv) {
      try {
        rows = await this.parseCSV(fileBuffer);
      } catch {
        rows = [];
      }
      if (!rows || rows.length === 0) {
        try {
          rows = await this.parseExcel(fileBuffer);
        } catch {
          // ignore
        }
      }
    } else {
      try {
        rows = await this.parseExcel(fileBuffer);
      } catch {
        try {
          rows = await this.parseCSV(fileBuffer);
        } catch {
          rows = [];
        }
      }
    }

    if (!rows || rows.length === 0) {
      try {
        rows = await this.parseExcel(fileBuffer);
      } catch {
        throw new BadRequestException(
          'Could not parse file. Please ensure it is a valid CSV or Excel file.',
        );
      }
    }

    const results = {
      total: rows.length,
      imported: 0,
      failed: 0,
      errors: [] as { row: number; error: string; data: any }[],
    };

    for (let i = 0; i < rows.length; i++) {
      const rawRow = rows[i];
      const rowNum = i + 1;

      try {
        const row = this.normalizeRow(rawRow);

        if (
          !row.tradeName ||
          row.quantity === undefined ||
          row.quantity === '' ||
          row.price === undefined ||
          row.price === ''
        ) {
          throw new Error(
            'Missing required fields: tradeName, quantity, or price',
          );
        }

        const safeTradeName = validateSafeString(
          row.tradeName,
          'tradeName',
          255,
        );
        const safeGenericName = row.genericName
          ? validateSafeString(row.genericName, 'genericName', 255)
          : null;
        const safeQuantity = validatePositiveInt(
          Number(row.quantity),
          'quantity',
          1,
        );
        const safePrice = validatePositiveInt(Number(row.price), 'price', 0);
        const safeBatchNumber = row.batchNumber
          ? validateSafeString(row.batchNumber, 'batchNumber', 100)
          : null;
        const safeLotNumber = row.lotNumber
          ? validateSafeString(row.lotNumber, 'lotNumber', 100)
          : null;
        const safeUnitCost =
          row.unitCost && !isNaN(Number(row.unitCost))
            ? validatePositiveInt(Number(row.unitCost), 'unitCost', 0)
            : null;

        const expiryDate = this.parseSpreadsheetDate(row.expiryDate);

        let categoryId: string | undefined;
        if (row.category) {
          const safeCategory = validateSafeString(
            row.category,
            'category',
            100,
          );
          const category = await prisma.category.findFirst({
            where: { name: { equals: safeCategory, mode: 'insensitive' } },
          });
          if (category) {
            categoryId = category.id;
          } else {
            const newCategory = await prisma.category.create({
              data: { name: safeCategory },
            });
            categoryId = newCategory.id;
          }
        } else {
          let defaultCategory = await prisma.category.findFirst({
            where: { name: { equals: 'General', mode: 'insensitive' } },
          });
          if (!defaultCategory) {
            defaultCategory = await prisma.category.create({
              data: { name: 'General' },
            });
          }
          categoryId = defaultCategory.id;
        }

        let manufacturerId: string | undefined;
        if (row.manufacturer) {
          const safeManufacturer = validateSafeString(
            row.manufacturer,
            'manufacturer',
            255,
          );
          const manufacturer = await prisma.manufacturer.findFirst({
            where: { name: { equals: safeManufacturer, mode: 'insensitive' } },
          });
          if (manufacturer) {
            manufacturerId = manufacturer.id;
          } else {
            const newManufacturer = await prisma.manufacturer.create({
              data: { name: safeManufacturer },
            });
            manufacturerId = newManufacturer.id;
          }
        } else {
          let defaultManufacturer = await prisma.manufacturer.findFirst({
            where: { name: { equals: 'General', mode: 'insensitive' } },
          });
          if (!defaultManufacturer) {
            defaultManufacturer = await prisma.manufacturer.create({
              data: { name: 'General' },
            });
          }
          manufacturerId = defaultManufacturer.id;
        }

        const existingMedicine = await prisma.medicine.findFirst({
          where: {
            tradeName: { equals: safeTradeName, mode: 'insensitive' },
          },
        });

        let medicine;
        if (existingMedicine) {
          medicine = existingMedicine;
        } else {
          medicine = await prisma.medicine.create({
            data: {
              tradeName: safeTradeName,
              genericName: safeGenericName || safeTradeName,
              categoryId,
              manufacturerId,
            },
          });
        }

        const existingInventory = await prisma.inventory.findFirst({
          where: {
            pharmacyId: safePharmacyId,
            medicineId: medicine.id,
            deletedAt: null,
          },
        });

        if (existingInventory) {
          await prisma.inventory.update({
            where: { id: existingInventory.id },
            data: {
              quantity: existingInventory.quantity + safeQuantity,
              price: safePrice,
              expiryDate: expiryDate ?? existingInventory.expiryDate,
            },
          });

          await prisma.inventoryHistory.create({
            data: {
              inventoryId: existingInventory.id,
              oldQuantity: existingInventory.quantity,
              newQuantity: existingInventory.quantity + safeQuantity,
              oldPrice: existingInventory.price,
              newPrice: safePrice,
              changedBy: safeUserId,
            },
          });

          await prisma.stockMovement.create({
            data: {
              inventoryId: existingInventory.id,
              type: 'ADD',
              quantity: safeQuantity,
              reason: 'Spreadsheet import',
              movedBy: safeUserId,
            },
          });
        } else {
          const inventory = await prisma.inventory.create({
            data: {
              pharmacyId: safePharmacyId,
              medicineId: medicine.id,
              quantity: safeQuantity,
              price: safePrice,
              expiryDate,
            },
          });

          await prisma.inventoryHistory.create({
            data: {
              inventoryId: inventory.id,
              oldQuantity: 0,
              newQuantity: safeQuantity,
              oldPrice: null,
              newPrice: safePrice,
              changedBy: safeUserId,
            },
          });

          await prisma.stockMovement.create({
            data: {
              inventoryId: inventory.id,
              type: 'ADD',
              quantity: safeQuantity,
              reason: 'Spreadsheet import',
              movedBy: safeUserId,
            },
          });
        }

        if (safeBatchNumber) {
          const existingBatch = await prisma.medicineBatch.findFirst({
            where: {
              batchNumber: safeBatchNumber,
              medicineId: medicine.id,
            },
          });

          if (existingBatch) {
            await prisma.medicineBatch.update({
              where: { id: existingBatch.id },
              data: {
                lotNumber: safeLotNumber,
                expiryDate,
                unitCost: safeUnitCost,
                unitSellingPrice: safePrice,
              },
            });
          } else {
            await prisma.medicineBatch.create({
              data: {
                batchNumber: safeBatchNumber,
                lotNumber: safeLotNumber,
                medicineId: medicine.id,
                expiryDate,
                unitCost: safeUnitCost || safePrice,
                unitSellingPrice: safePrice,
                initialStock: safeQuantity,
                currentStock: safeQuantity,
              },
            });
          }
        }

        results.imported++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          row: rowNum,
          error: (error as Error).message,
          data: rawRow,
        });
      }
    }

    this.apiCache.invalidate('medicine:availability:');
    this.apiCache.invalidate('search:');
    return results;
  }

  private parseSpreadsheetDate(value: any): Date | undefined {
    if (!value) return undefined;
    if (value instanceof Date) return isNaN(value.getTime()) ? undefined : value;

    if (
      typeof value === 'number' ||
      (typeof value === 'string' && !isNaN(Number(value)) && !value.includes('/') && !value.includes('-'))
    ) {
      const num = Number(value);
      if (num > 30000 && num < 100000) {
        const utcDays = num - 25569;
        const date = new Date(utcDays * 86400 * 1000);
        if (!isNaN(date.getTime())) return date;
      }
    }

    const str = String(value).trim();
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }

    const parts = str.split(/[\/\-\.]/);
    if (parts.length === 3) {
      const p1 = parseInt(parts[0], 10);
      const p2 = parseInt(parts[1], 10);
      const p3 = parseInt(parts[2], 10);
      if (p3 > 1000) {
        const d1 = new Date(p3, p1 - 1, p2);
        if (!isNaN(d1.getTime())) return d1;
        const d2 = new Date(p3, p2 - 1, p1);
        if (!isNaN(d2.getTime())) return d2;
      }
    }

    return undefined;
  }

  private async parseCSV(buffer: Buffer): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const results: any[] = [];
      const stream = Readable.from(buffer);

      stream
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => resolve(results))
        .on('error', (error) => reject(error));
    });
  }

  private async parseExcel(buffer: Buffer): Promise<any[]> {
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return [];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = xlsx.utils.sheet_to_json(worksheet);
    return jsonData;
  }
}
