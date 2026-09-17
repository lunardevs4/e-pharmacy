import { Test, TestingModule } from '@nestjs/testing';
import { MaintenanceGuard } from './maintenance.guard';
import { SystemService } from '../../system/system.service';
import { Reflector } from '@nestjs/core';
import { ServiceUnavailableException } from '@nestjs/common';
import { UserRole } from '@generated/prisma';

describe('MaintenanceGuard', () => {
  let guard: MaintenanceGuard;
  let systemService: jest.Mocked<any>;

  beforeEach(async () => {
    systemService = {
      getSystemStatus: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaintenanceGuard,
        Reflector,
        { provide: SystemService, useValue: systemService },
      ],
    }).compile();

    guard = module.get<MaintenanceGuard>(MaintenanceGuard);
  });

  const createMockContext = (url: string, user?: any): any => ({
    switchToHttp: () => ({
      getRequest: () => ({
        url,
        user,
      }),
    }),
  });

  it('should allow access when system is OPERATIONAL', async () => {
    systemService.getSystemStatus.mockResolvedValue({ mode: 'OPERATIONAL' });
    const context = createMockContext('/api/v1/medicines');

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should allow exempt paths during MAINTENANCE', async () => {
    systemService.getSystemStatus.mockResolvedValue({
      mode: 'MAINTENANCE',
      message: 'Maintenance active',
    });
    const context = createMockContext('/health');

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should allow ADMIN users during MAINTENANCE', async () => {
    systemService.getSystemStatus.mockResolvedValue({
      mode: 'MAINTENANCE',
      message: 'Maintenance active',
    });
    const context = createMockContext('/api/v1/medicines', {
      role: UserRole.ADMIN,
    });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should throw ServiceUnavailableException (503) for non-admin during MAINTENANCE', async () => {
    systemService.getSystemStatus.mockResolvedValue({
      mode: 'MAINTENANCE',
      message: 'Scheduled maintenance',
      reason: 'Upgrading database',
    });
    const context = createMockContext('/api/v1/medicines', {
      role: UserRole.PATIENT,
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('should throw SYSTEM_EMERGENCY_LOCKDOWN code during LOCKDOWN mode for non-admin', async () => {
    systemService.getSystemStatus.mockResolvedValue({
      mode: 'LOCKDOWN',
      reason: 'Emergency security lockdown',
    });
    const context = createMockContext('/api/v1/patients/profile', {
      role: UserRole.PATIENT,
    });

    try {
      await guard.canActivate(context);
      fail('Should have thrown ServiceUnavailableException');
    } catch (err: any) {
      expect(err).toBeInstanceOf(ServiceUnavailableException);
      const res = err.getResponse();
      expect(res.code).toBe('SYSTEM_EMERGENCY_LOCKDOWN');
    }
  });
});
