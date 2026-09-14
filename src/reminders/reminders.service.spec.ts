import { RemindersService } from './reminders.service';
import { ReminderStatus, NotificationType, UserRole } from '@generated/prisma';

describe('RemindersService - SMS Delivery & Webhooks', () => {
  let service: RemindersService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      reminderSchedule: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      reminderLog: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      patient: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      user: {
        findFirst: jest.fn(),
      },
      medicine: {
        findFirst: jest.fn(),
      },
    };

    const mockPrismaService = { prisma: mockPrisma };
    service = new RemindersService(mockPrismaService as any);
  });

  describe('handleDeliveryStatusWebhook', () => {
    it('should update reminder log status to DELIVERED on successful delivery report', async () => {
      mockPrisma.reminderLog.findFirst.mockResolvedValue({
        id: 'log-123',
        status: ReminderStatus.SENT,
        providerReference: 'ATXid_abc123',
      });

      mockPrisma.reminderLog.update.mockResolvedValue({
        id: 'log-123',
        status: ReminderStatus.DELIVERED,
      });

      const result = await service.handleDeliveryStatusWebhook({
        id: 'ATXid_abc123',
        status: 'Delivered',
      });

      expect(result.success).toBe(true);
      expect(result.updated).toBe(true);
      expect(result.newStatus).toBe(ReminderStatus.DELIVERED);
      expect(mockPrisma.reminderLog.update).toHaveBeenCalledWith({
        where: { id: 'log-123' },
        data: expect.objectContaining({
          status: ReminderStatus.DELIVERED,
          error: null,
        }),
      });
    });

    it('should update reminder log to FAILED with failure reason on provider failure', async () => {
      mockPrisma.reminderLog.findFirst.mockResolvedValue({
        id: 'log-123',
        status: ReminderStatus.SENT,
        providerReference: 'ATXid_abc123',
      });

      mockPrisma.reminderLog.update.mockResolvedValue({
        id: 'log-123',
        status: ReminderStatus.FAILED,
      });

      const result = await service.handleDeliveryStatusWebhook({
        providerMessageId: 'ATXid_abc123',
        status: 'Failed',
        failureReason: 'InvalidPhoneNumber',
      });

      expect(result.success).toBe(true);
      expect(result.newStatus).toBe(ReminderStatus.FAILED);
      expect(mockPrisma.reminderLog.update).toHaveBeenCalledWith({
        where: { id: 'log-123' },
        data: expect.objectContaining({
          status: ReminderStatus.FAILED,
          error: 'InvalidPhoneNumber',
        }),
      });
    });

    it('should not downgrade COMPLETED dose back to DELIVERED/SENT', async () => {
      mockPrisma.reminderLog.findFirst.mockResolvedValue({
        id: 'log-123',
        status: ReminderStatus.COMPLETED,
        providerReference: 'ATXid_abc123',
      });

      const result = await service.handleDeliveryStatusWebhook({
        id: 'ATXid_abc123',
        status: 'Delivered',
      });

      expect(result.success).toBe(true);
      expect(result.updated).toBe(false);
      expect(result.message).toContain('already marked as COMPLETED');
      expect(mockPrisma.reminderLog.update).not.toHaveBeenCalled();
    });
  });

  describe('handleInboundSmsWebhook', () => {
    it('should confirm dose when patient replies YES', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        phone: '+250788123456',
        patient: { id: 'patient-1' },
      });

      mockPrisma.reminderLog.findFirst.mockResolvedValue({
        id: 'log-456',
        status: ReminderStatus.SENT,
        patientId: 'patient-1',
        schedule: {
          medicine: { tradeName: 'Amoxicillin' },
        },
      });

      mockPrisma.reminderLog.update.mockResolvedValue({
        id: 'log-456',
        status: ReminderStatus.COMPLETED,
        confirmationSource: 'SMS',
        confirmationTime: new Date(),
      });

      const result = await service.handleInboundSmsWebhook({
        from: '+250788123456',
        text: 'YES',
      });

      expect(result.success).toBe(true);
      expect(result.confirmed).toBe(true);
      expect(result.medicine).toBe('Amoxicillin');
      expect(mockPrisma.reminderLog.update).toHaveBeenCalledWith({
        where: { id: 'log-456' },
        data: expect.objectContaining({
          status: ReminderStatus.COMPLETED,
          confirmationSource: 'SMS',
        }),
      });
    });

    it('should support Kinyarwanda confirmation keywords like EGO or NAYIFASHE', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        phone: '+250788123456',
        patient: { id: 'patient-1' },
      });

      mockPrisma.reminderLog.findFirst.mockResolvedValue({
        id: 'log-456',
        status: ReminderStatus.DELIVERED,
        schedule: {
          medicine: { tradeName: 'Paracetamol' },
        },
      });

      mockPrisma.reminderLog.update.mockResolvedValue({
        id: 'log-456',
        status: ReminderStatus.COMPLETED,
      });

      const result = await service.handleInboundSmsWebhook({
        from: '0788123456',
        text: 'ego',
      });

      expect(result.success).toBe(true);
      expect(result.confirmed).toBe(true);
    });

    it('should ignore non-affirmative messages', async () => {
      const result = await service.handleInboundSmsWebhook({
        from: '+250788123456',
        text: 'Hello who is this?',
      });

      expect(result.success).toBe(true);
      expect(result.confirmed).toBe(false);
      expect(mockPrisma.user.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('getLogs history query filtering', () => {
    it('should apply status, date range, and pagination filters', async () => {
      const user = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        role: UserRole.PATIENT,
      };

      mockPrisma.patient.findFirst.mockResolvedValue({
        id: 'patient-uuid',
      });

      mockPrisma.reminderLog.findMany.mockResolvedValue([
        { id: 'log-1', status: ReminderStatus.DELIVERED },
      ]);
      mockPrisma.reminderLog.count.mockResolvedValue(1);

      const result = await service.getLogs(user as any, {
        page: 1,
        limit: 10,
        status: ReminderStatus.DELIVERED,
        startDate: '2026-09-01T00:00:00.000Z',
        endDate: '2026-09-14T00:00:00.000Z',
      });

      expect(result.data).toHaveLength(1);
      expect(mockPrisma.reminderLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            patientId: 'patient-uuid',
            status: ReminderStatus.DELIVERED,
          }),
        }),
      );
    });
  });
});
