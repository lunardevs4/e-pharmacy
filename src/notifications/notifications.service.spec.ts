import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { UserRole } from '@generated/prisma';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';

describe('NotificationsService - Deletion Functionality', () => {
  let service: NotificationsService;
  let mockPrisma: any;

  const patientUser = {
    id: 'a0000000-0000-0000-0000-000000000001',
    role: UserRole.PATIENT,
  };

  const otherUser = {
    id: 'b0000000-0000-0000-0000-000000000002',
    role: UserRole.PATIENT,
  };

  const adminUser = {
    id: 'c0000000-0000-0000-0000-000000000003',
    role: UserRole.ADMIN,
  };

  const testNotificationId = 'd0000000-0000-0000-0000-000000000004';

  beforeEach(async () => {
    mockPrisma = {
      notification: {
        findUnique: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      pharmacy: {
        findMany: jest.fn(),
      },
      pharmacyEmployee: {
        findMany: jest.fn(),
      },
      user: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: PrismaService,
          useValue: { prisma: mockPrisma },
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  describe('delete', () => {
    it('should successfully delete a notification owned by the authenticated patient', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue({
        id: testNotificationId,
        userId: patientUser.id,
        title: 'Prescription Ready',
      });
      mockPrisma.notification.delete.mockResolvedValue({ id: testNotificationId });

      const result = await service.delete(patientUser, testNotificationId);

      expect(mockPrisma.notification.findUnique).toHaveBeenCalledWith({
        where: { id: testNotificationId },
      });
      expect(mockPrisma.notification.delete).toHaveBeenCalledWith({
        where: { id: testNotificationId },
      });
      expect(result).toEqual({ success: true, message: 'Notification deleted successfully' });
    });

    it('should allow admin to delete any notification', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue({
        id: testNotificationId,
        userId: otherUser.id,
        title: 'Admin notice',
      });
      mockPrisma.notification.delete.mockResolvedValue({ id: testNotificationId });

      const result = await service.delete(adminUser, testNotificationId);

      expect(mockPrisma.notification.delete).toHaveBeenCalledWith({
        where: { id: testNotificationId },
      });
      expect(result.success).toBe(true);
    });

    it('should throw NotFoundException if notification does not exist', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue(null);

      await expect(service.delete(patientUser, testNotificationId)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.notification.delete).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException if user attempts to delete another user notification', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue({
        id: testNotificationId,
        userId: otherUser.id,
        title: 'Private Patient Notification',
      });

      await expect(service.delete(patientUser, testNotificationId)).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrisma.notification.delete).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if notification ID is an invalid UUID', async () => {
      await expect(service.delete(patientUser, 'invalid-uuid-string')).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrisma.notification.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('deleteAll', () => {
    it('should delete only the notifications belonging to the authenticated user', async () => {
      mockPrisma.notification.deleteMany.mockResolvedValue({ count: 5 });

      const result = await service.deleteAll(patientUser);

      expect(mockPrisma.notification.deleteMany).toHaveBeenCalledWith({
        where: { userId: patientUser.id },
      });
      expect(result).toEqual({ success: true, count: 5 });
    });

    it('should handle empty collections gracefully', async () => {
      mockPrisma.notification.deleteMany.mockResolvedValue({ count: 0 });

      const result = await service.deleteAll(patientUser);

      expect(mockPrisma.notification.deleteMany).toHaveBeenCalledWith({
        where: { userId: patientUser.id },
      });
      expect(result).toEqual({ success: true, count: 0 });
    });
  });
});
