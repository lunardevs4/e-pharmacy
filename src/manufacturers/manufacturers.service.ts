import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateManufacturerDto, UpdateManufacturerDto } from './dto/manufacturers.dto';
import { validateUuid, sanitizeDeep } from '../common/security/security.util';

@Injectable()
export class ManufacturersService {
  constructor(private prismaService: PrismaService) { }

  create(createManufacturerDto: CreateManufacturerDto) {
    const prisma = this.prismaService.prisma;
    const safeDto = sanitizeDeep(createManufacturerDto);
    return prisma.manufacturer.create({ data: safeDto });
  }

  findAll() {
    const prisma = this.prismaService.prisma;
    return prisma.manufacturer.findMany({ where: { isActive: true, deletedAt: null } });
  }

  findOne(id: string) {
    const prisma = this.prismaService.prisma;
    const safeId = validateUuid(id, 'id');
    return prisma.manufacturer.findUnique({ where: { id: safeId }, include: { medicines: true } });
  }

  async update(id: string, updateManufacturerDto: UpdateManufacturerDto) {
    const prisma = this.prismaService.prisma;
    const safeId = validateUuid(id, 'id');
    const safeDto = sanitizeDeep(updateManufacturerDto);
    const manufacturer = await prisma.manufacturer.findUnique({ where: { id: safeId } });
    if (!manufacturer) throw new NotFoundException('Manufacturer not found');
    return prisma.manufacturer.update({ where: { id: safeId }, data: safeDto });
  }

  async remove(id: string) {
    const prisma = this.prismaService.prisma;
    const safeId = validateUuid(id, 'id');
    const manufacturer = await prisma.manufacturer.findUnique({ where: { id: safeId } });
    if (!manufacturer) throw new NotFoundException('Manufacturer not found');
    return prisma.manufacturer.update({ where: { id: safeId }, data: { deletedAt: new Date(), isActive: false } });
  }
}
