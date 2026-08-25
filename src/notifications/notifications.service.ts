import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { UserRole } from '@generated/prisma';
import { validateUuid } from '../common/security/security.util';

interface AuthenticatedUser {
  id: string;
  role: UserRole;
}

@Injectable()
export class NotificationsService {
  constructor(private prismaService: PrismaService) { }

  async findAll(user: AuthenticatedUser) {
    const prisma = this.prismaService.prisma;
    const safeUserId = validateUuid(user.id, 'userId');

    if (user.role === UserRole.ADMIN) {
      return prisma.notification.findMany({
        orderBy: { createdAt: 'desc' },
      });
    }

    if (user.role === UserRole.PHARMACY_OWNER) {
      const ownedPharmacies = await prisma.pharmacy.findMany({
        where: { ownerId: safeUserId },
        select: { id: true },
      });
      const pharmacyIds = ownedPharmacies.map((p) => p.id);
      const relatedUsers = await prisma.user.findMany({
        where: {
          OR: [
            { id: safeUserId },
            { pharmacyEmployees: { some: { pharmacyId: { in: pharmacyIds } } } },
            { pharmacies: { some: { id: { in: pharmacyIds } } } },
            { patient: { reservations: { some: { pharmacyId: { in: pharmacyIds } } } } },
          ],
        },
        select: { id: true },
      });
      const userIds = [...new Set([safeUserId, ...relatedUsers.map((u) => u.id)])];
      return prisma.notification.findMany({
        where: { userId: { in: userIds } },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (user.role === UserRole.PHARMACIST) {
      const staff = await prisma.pharmacyEmployee.findMany({
        where: { userId: safeUserId, role: UserRole.PHARMACIST },
        select: { pharmacyId: true },
      });
      const pharmacyIds = staff.map((s) => s.pharmacyId);
      const relatedUsers = await prisma.user.findMany({
        where: {
          OR: [
            { id: safeUserId },
            { pharmacyEmployees: { some: { pharmacyId: { in: pharmacyIds } } } },
            { pharmacies: { some: { id: { in: pharmacyIds } } } },
            { patient: { reservations: { some: { pharmacyId: { in: pharmacyIds } } } } },
          ],
        },
        select: { id: true },
      });
      const userIds = [...new Set([safeUserId, ...relatedUsers.map((u) => u.id)])];
      return prisma.notification.findMany({
        where: { userId: { in: userIds } },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (user.role === UserRole.PATIENT || user.role === UserRole.GOVERNMENT || user.role === UserRole.INSURANCE) {
      return prisma.notification.findMany({
        where: { userId: safeUserId },
        orderBy: { createdAt: 'desc' },
      });
    }

    throw new ForbiddenException('Insufficient permissions to access notifications');
  }

  async markAsRead(user: AuthenticatedUser, id: string) {
    const prisma = this.prismaService.prisma;
    const safeUserId = validateUuid(user.id, 'userId');
    const safeId = validateUuid(id, 'id');

    const notification = await prisma.notification.findUnique({ where: { id: safeId } });
    if (!notification) throw new NotFoundException('Notification not found');

    if (notification.userId === safeUserId) {
      return prisma.notification.update({ where: { id: safeId }, data: { isRead: true } });
    }

    if (user.role === UserRole.ADMIN || user.role === UserRole.INSURANCE) {
      return prisma.notification.update({ where: { id: safeId }, data: { isRead: true } });
    }

    if (user.role === UserRole.PHARMACY_OWNER) {
      const ownedPharmacies = await prisma.pharmacy.findMany({
        where: { ownerId: safeUserId },
        select: { id: true },
      });
      const pharmacyIds = ownedPharmacies.map((p) => p.id);
      const relatedUsers = await prisma.user.findMany({
        where: {
          OR: [
            { pharmacyEmployees: { some: { pharmacyId: { in: pharmacyIds } } } },
            { pharmacies: { some: { id: { in: pharmacyIds } } } },
            { patient: { reservations: { some: { pharmacyId: { in: pharmacyIds } } } } },
          ],
        },
        select: { id: true },
      });
      const userIds = [safeUserId, ...relatedUsers.map((u) => u.id)];
      if (userIds.includes(notification.userId)) {
        return prisma.notification.update({ where: { id: safeId }, data: { isRead: true } });
      }
    }

    if (user.role === UserRole.PHARMACIST) {
      const staff = await prisma.pharmacyEmployee.findMany({
        where: { userId: safeUserId, role: UserRole.PHARMACIST },
        select: { pharmacyId: true },
      });
      const pharmacyIds = staff.map((s) => s.pharmacyId);
      const relatedUsers = await prisma.user.findMany({
        where: {
          OR: [
            { pharmacyEmployees: { some: { pharmacyId: { in: pharmacyIds } } } },
            { pharmacies: { some: { id: { in: pharmacyIds } } } },
            { patient: { reservations: { some: { pharmacyId: { in: pharmacyIds } } } } },
          ],
        },
        select: { id: true },
      });
      const userIds = [safeUserId, ...relatedUsers.map((u) => u.id)];
      if (userIds.includes(notification.userId)) {
        return prisma.notification.update({ where: { id: safeId }, data: { isRead: true } });
      }
    }

    throw new ForbiddenException('This notification does not belong to you or your pharmacy scope');
  }

  async markAllAsRead(user: AuthenticatedUser) {
    const prisma = this.prismaService.prisma;
    const safeUserId = validateUuid(user.id, 'userId');

    if (user.role === UserRole.ADMIN) {
      return prisma.notification.updateMany({
        where: { isRead: false },
        data: { isRead: true },
      });
    }

    if (user.role === UserRole.PHARMACY_OWNER) {
      const ownedPharmacies = await prisma.pharmacy.findMany({
        where: { ownerId: safeUserId },
        select: { id: true },
      });
      const pharmacyIds = ownedPharmacies.map((p) => p.id);
      const relatedUsers = await prisma.user.findMany({
        where: {
          OR: [
            { id: safeUserId },
            { pharmacyEmployees: { some: { pharmacyId: { in: pharmacyIds } } } },
            { pharmacies: { some: { id: { in: pharmacyIds } } } },
            { patient: { reservations: { some: { pharmacyId: { in: pharmacyIds } } } } },
          ],
        },
        select: { id: true },
      });
      const userIds = [...new Set(relatedUsers.map((u) => u.id))];
      return prisma.notification.updateMany({
        where: { userId: { in: userIds }, isRead: false },
        data: { isRead: true },
      });
    }

    if (user.role === UserRole.PHARMACIST) {
      const staff = await prisma.pharmacyEmployee.findMany({
        where: { userId: safeUserId, role: UserRole.PHARMACIST },
        select: { pharmacyId: true },
      });
      const pharmacyIds = staff.map((s) => s.pharmacyId);
      const relatedUsers = await prisma.user.findMany({
        where: {
          OR: [
            { id: safeUserId },
            { pharmacyEmployees: { some: { pharmacyId: { in: pharmacyIds } } } },
            { pharmacies: { some: { id: { in: pharmacyIds } } } },
            { patient: { reservations: { some: { pharmacyId: { in: pharmacyIds } } } } },
          ],
        },
        select: { id: true },
      });
      const userIds = [...new Set(relatedUsers.map((u) => u.id))];
      return prisma.notification.updateMany({
        where: { userId: { in: userIds }, isRead: false },
        data: { isRead: true },
      });
    }

    if (user.role === UserRole.PATIENT || user.role === UserRole.GOVERNMENT || user.role === UserRole.INSURANCE) {
      return prisma.notification.updateMany({
        where: { userId: safeUserId, isRead: false },
        data: { isRead: true },
      });
    }

    throw new ForbiddenException('Insufficient permissions');
  }
}
