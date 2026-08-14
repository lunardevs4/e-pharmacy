import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateManufacturerDto, UpdateManufacturerDto } from './dto/manufacturers.dto';
import { validateUuid, sanitizeDeep } from '../common/security/security.util';

@Injectable()
export class ManufacturersService {
  constructor(private prismaService: PrismaService) { }

  async create(createManufacturerDto: CreateManufacturerDto) {
    const prisma = this.prismaService.prisma;
    const safeDto = sanitizeDeep(createManufacturerDto);
    try { return await prisma.manufacturer.create({ data: { name: safeDto.name.trim() } }); }
    catch (error) { if ((error as any)?.code === 'P2002') throw new ConflictException('Manufacturer name already exists'); throw error; }
  }

  findAll(search?: string) {
    const prisma = this.prismaService.prisma;
    return prisma.manufacturer.findMany({ where: search ? { name: { contains: search.trim(), mode: 'insensitive' } } : {}, orderBy: { name: 'asc' } });
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
    try { return await prisma.manufacturer.update({ where: { id: safeId }, data: { name: safeDto.name?.trim() } }); }
    catch (error) { if ((error as any)?.code === 'P2002') throw new ConflictException('Manufacturer name already exists'); throw error; }
  }

  async remove(id: string) {
    const prisma = this.prismaService.prisma;
    const safeId = validateUuid(id, 'id');
    const manufacturer = await prisma.manufacturer.findUnique({ where: { id: safeId } });
    if (!manufacturer) throw new NotFoundException('Manufacturer not found');
    return prisma.manufacturer.delete({ where: { id: safeId } });
  }
}
