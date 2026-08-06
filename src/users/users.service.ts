import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { UpdateUserDto } from './dto/users.dto';
import { validatePositiveInt, validateUuid, sanitizeDeep } from '../common/security/security.util';

@Injectable()
export class UsersService {
  constructor(private prismaService: PrismaService) { }

  async getProfile(userId: string) {
    const prisma = this.prismaService.prisma;
    const safeUserId = validateUuid(userId, 'userId');
    const user = await prisma.user.findUnique({
      where: { id: safeUserId },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
        patient: true,
        pharmacy: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateProfile(userId: string, updateUserDto: UpdateUserDto) {
    const prisma = this.prismaService.prisma;
    const safeUserId = validateUuid(userId, 'userId');
    const safeDto = sanitizeDeep(updateUserDto);
    return prisma.user.update({
      where: { id: safeUserId },
      data: safeDto,
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });
  }

  async softDelete(userId: string) {
    const prisma = this.prismaService.prisma;
    const safeUserId = validateUuid(userId, 'userId');
    return prisma.user.update({
      where: { id: safeUserId },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  async findAll(page: number = 1, limit: number = 10) {
    const prisma = this.prismaService.prisma;
    const safePage = validatePositiveInt(page, 'page', 1);
    const safeLimit = validatePositiveInt(limit, 'limit', 10);
    const skip = (safePage - 1) * safeLimit;
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        skip,
        take: safeLimit,
        where: { deletedAt: null },
        select: {
          id: true,
          email: true,
          phone: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
      }),
      prisma.user.count({ where: { deletedAt: null } }),
    ]);

    return {
      data: users,
      meta: { page: safePage, limit: safeLimit, total, totalPages: Math.ceil(total / safeLimit) },
    };
  }
}
