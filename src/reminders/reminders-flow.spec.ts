import { ReminderSchedulerService } from './reminder-scheduler.service';
import { RemindersService } from './reminders.service';
import { ReminderWebhooksController } from './reminder-webhooks.controller';
import { CommunicationService } from '../common/communication/communication.service';
import { MockSmsProvider } from '../common/communication/sms/mock-sms.provider';
import { ReminderStatus, NotificationType, UserRole } from '@generated/prisma';

describe('SMS Medication Reminder End-to-End Pipeline', () => {
  let mockPrisma: any;
  let communicationService: CommunicationService;
  let schedulerService: ReminderSchedulerService;
  let remindersService: RemindersService;
  let webhooksController: ReminderWebhooksController;

  const mockPatientUser = {
    id: '550e8400-e29b-41d4-a716-446655440001',
    phone: '+250788111222',
    firstName: 'Aline',
    lastName: 'Uwase',
    email: 'aline@example.com',
  };

  const mockPatient = {
    id: '550e8400-e29b-41d4-a716-446655440002',
    userId: mockPatientUser.id,
    user: mockPatientUser,
  };

  const mockSchedule = {
    id: 'schedule-uuid-1',
    patientId: mockPatient.id,
    medicineId: 'med-uuid-1',
    dosage: '500mg',
    channel: NotificationType.SMS,
    startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    timeOfDay: [new Date().toTimeString().slice(0, 5)],
    patient: mockPatient,
    medicine: { id: 'med-uuid-1', tradeName: 'Amoxicillin' },
  };

  // In-memory simulation of database records
  let createdLogs: any[] = [];

  beforeEach(() => {
    createdLogs = [];

    mockPrisma = {
      $connect: jest.fn().mockResolvedValue(undefined),
      $disconnect: jest.fn().mockResolvedValue(undefined),
      reminderSchedule: {
        findMany: jest.fn().mockResolvedValue([mockSchedule]),
      },
      reminderLog: {
        findFirst: jest.fn().mockImplementation(({ where }) => {
          if (where?.providerReference) {
            return (
              createdLogs.find(
                (l) => l.providerReference === where.providerReference,
              ) || null
            );
          }
          if (where?.scheduleId) {
            return (
              createdLogs.find((l) => l.scheduleId === where.scheduleId) || null
            );
          }
          if (where?.patientId) {
            return (
              createdLogs.find(
                (l) =>
                  l.patientId === where.patientId &&
                  (!where.status?.in || where.status.in.includes(l.status)),
              ) || null
            );
          }
          return null;
        }),
        create: jest.fn().mockImplementation(({ data }) => {
          const newLog = {
            id: `log-uuid-${createdLogs.length + 1}`,
            createdAt: new Date(),
            ...data,
            schedule: mockSchedule,
          };
          createdLogs.push(newLog);
          return newLog;
        }),
        update: jest.fn().mockImplementation(({ where, data }) => {
          const log = createdLogs.find((l) => l.id === where.id);
          if (log) {
            Object.assign(log, data);
            return log;
          }
          return null;
        }),
        findMany: jest.fn().mockImplementation(({ where }) => {
          return createdLogs.filter((l) => {
            if (where?.status && l.status !== where.status) return false;
            if (where?.patientId && l.patientId !== where.patientId)
              return false;
            return true;
          });
        }),
        count: jest.fn().mockImplementation(() => createdLogs.length),
      },
      systemSetting: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      user: {
        findFirst: jest.fn().mockImplementation(({ where }) => {
          if (where?.phone?.in?.includes(mockPatientUser.phone)) {
            return {
              ...mockPatientUser,
              patient: { id: mockPatient.id },
            };
          }
          return null;
        }),
      },
      patient: {
        findFirst: jest.fn().mockResolvedValue(mockPatient),
      },
    };

    const mockPrismaService = { prisma: mockPrisma };
    const mockEmailService = {
      sendNotificationEmail: jest.fn().mockResolvedValue(undefined),
    };

    // Use fast MockSmsProvider
    const mockSmsProvider = new MockSmsProvider(0);
    communicationService = new CommunicationService(mockSmsProvider);

    schedulerService = new ReminderSchedulerService(
      mockPrismaService as any,
      mockEmailService as any,
      communicationService,
    );

    remindersService = new RemindersService(mockPrismaService as any);
    webhooksController = new ReminderWebhooksController(remindersService);
  });

  it('runs complete lifecycle: fires reminder -> SMS sent -> webhook delivered -> patient replies YES -> dose confirmed', async () => {
    // 1. Scheduler fires due reminder
    await schedulerService.dispatchDueReminders();

    expect(createdLogs).toHaveLength(1);
    const sentLog = createdLogs[0];
    expect(sentLog.status).toBe(ReminderStatus.SENT);
    expect(sentLog.provider).toBe('mock');
    expect(sentLog.providerReference).toMatch(/^mock-msg-/);
    expect(sentLog.type).toBe(NotificationType.SMS);

    // 2. Provider sends delivery status webhook ("Delivered")
    const deliveryWebhookRes = await webhooksController.handleDeliveryStatus({
      id: sentLog.providerReference,
      status: 'Delivered',
    });

    expect(deliveryWebhookRes.success).toBe(true);
    expect(deliveryWebhookRes.newStatus).toBe(ReminderStatus.DELIVERED);
    expect(sentLog.status).toBe(ReminderStatus.DELIVERED);

    // 3. Patient confirms intake via SMS reply ("YES")
    const inboundWebhookRes = await webhooksController.handleInboundSms({
      from: '+250788111222',
      text: 'YES',
    });

    expect(inboundWebhookRes.success).toBe(true);
    expect(inboundWebhookRes.confirmed).toBe(true);
    expect(inboundWebhookRes.medicine).toBe('Amoxicillin');
    expect(sentLog.status).toBe(ReminderStatus.COMPLETED);
    expect(sentLog.confirmationSource).toBe('SMS');
    expect(sentLog.confirmationTime).toBeDefined();

    // 4. Query delivery history
    const history = await remindersService.getLogs(
      { id: mockPatientUser.id, role: UserRole.PATIENT },
      { status: ReminderStatus.COMPLETED },
    );

    expect(history.data).toHaveLength(1);
    expect(history.data[0].status).toBe(ReminderStatus.COMPLETED);
  });
});
