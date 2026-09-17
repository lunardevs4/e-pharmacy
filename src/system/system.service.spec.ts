import { Test, TestingModule } from '@nestjs/testing';
import { SystemService } from './system.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { UserRole } from '@generated/prisma';

describe('SystemService', () => {
  let service: SystemService;
  let prismaService: jest.Mocked<any>;
  let auditLogsService: jest.Mocked<any>;

  const mockAdminUser = {
    id: 'admin-123',
    email: 'admin@epharmacy.gov.rw',
    role: UserRole.ADMIN,
  };

  let currentDbRecord: any;

  beforeEach(async () => {
    currentDbRecord = {
      id: 'system-status-singleton',
      maintenanceMode: false,
      emergencyLockdown: false,
      maintenanceMessage: 'All systems operational',
      enabledAt: null,
      disabledAt: null,
      scheduledStart: null,
      scheduledEnd: null,
      updatedAt: new Date(),
      updatedBy: 'admin-123',
    };

    prismaService = {
      prisma: {
        systemStatus: {
          findFirst: jest.fn().mockImplementation(() => Promise.resolve(currentDbRecord)),
          create: jest.fn().mockImplementation((args) => {
            currentDbRecord = { ...currentDbRecord, ...args.data };
            return Promise.resolve(currentDbRecord);
          }),
          update: jest.fn().mockImplementation((args) => {
            currentDbRecord = { ...currentDbRecord, ...args.data };
            return Promise.resolve(currentDbRecord);
          }),
        },
      },
    };

    auditLogsService = {
      log: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SystemService,
        { provide: PrismaService, useValue: prismaService },
        { provide: AuditLogsService, useValue: auditLogsService },
      ],
    }).compile();

    service = module.get<SystemService>(SystemService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getSystemStatus', () => {
    it('should return default OPERATIONAL status if database is empty', async () => {
      currentDbRecord = null;

      const status = await service.getSystemStatus();
      expect(status.mode).toBe('OPERATIONAL');
    });

    it('should return system status from database when present', async () => {
      const status = await service.getSystemStatus();
      expect(status.mode).toBe('OPERATIONAL');
    });
  });

  describe('enableMaintenance', () => {
    it('should set mode to MAINTENANCE and log audit action', async () => {
      const result = await service.enableMaintenance(
        {
          message: 'Scheduled maintenance in progress',
          reason: 'Database upgrade',
        },
        mockAdminUser,
      );

      expect(result.systemStatus.mode).toBe('MAINTENANCE');
      expect(auditLogsService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'SYSTEM_MAINTENANCE_ENABLED',
        }),
      );
    });
  });

  describe('enableEmergencyLockdown', () => {
    it('should set mode to LOCKDOWN and log emergency audit action', async () => {
      const result = await service.enableEmergencyLockdown(
        { reason: 'Security breach detected' },
        mockAdminUser,
      );

      expect(result.systemStatus.mode).toBe('LOCKDOWN');
      expect(auditLogsService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'SYSTEM_EMERGENCY_LOCKDOWN',
        }),
      );
    });
  });

  describe('resumeNormalOperation', () => {
    it('should restore system to OPERATIONAL mode', async () => {
      currentDbRecord.maintenanceMode = true;

      const result = await service.resumeNormalOperation(
        { reason: 'Resolved incident' },
        mockAdminUser,
      );

      expect(result.systemStatus.mode).toBe('OPERATIONAL');
      expect(auditLogsService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'SYSTEM_MAINTENANCE_DISABLED',
        }),
      );
    });
  });
});
