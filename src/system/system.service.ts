import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import {
  EnableMaintenanceDto,
  DisableMaintenanceDto,
  EmergencyLockdownDto,
  EmergencyUnlockDto,
  ScheduleMaintenanceDto,
} from './dto/system.dto';

export interface SystemStatusState {
  id: string;
  maintenanceMode: boolean;
  emergencyLockdown: boolean;
  maintenanceMessage: string | null;
  enabledAt: Date | null;
  disabledAt: Date | null;
  scheduledStart: Date | null;
  scheduledEnd: Date | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const DEFAULT_STATUS_STATE: SystemStatusState = {
  id: 'global-system-status',
  maintenanceMode: false,
  emergencyLockdown: false,
  maintenanceMessage: null,
  enabledAt: null,
  disabledAt: null,
  scheduledStart: null,
  scheduledEnd: null,
  updatedBy: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

@Injectable()
export class SystemService implements OnModuleInit {
  private readonly logger = new Logger(SystemService.name);
  private cachedStatus: SystemStatusState = { ...DEFAULT_STATUS_STATE };
  private activeReason?: string;

  constructor(
    private prismaService: PrismaService,
    private auditLogsService: AuditLogsService,
  ) {}

  async onModuleInit() {
    await this.refreshCache();
  }

  /**
   * Refreshes the in-memory cached state from the database.
   * Ensures only one active global configuration row exists.
   */
  async refreshCache(): Promise<SystemStatusState> {
    try {
      const prisma = this.prismaService.prisma;
      let record = await prisma.systemStatus.findFirst({
        orderBy: { createdAt: 'desc' },
      });

      if (!record) {
        record = await prisma.systemStatus.create({
          data: {
            maintenanceMode: false,
            emergencyLockdown: false,
            maintenanceMessage: null,
          },
        });
      }

      this.cachedStatus = {
        id: record.id,
        maintenanceMode: record.maintenanceMode,
        emergencyLockdown: record.emergencyLockdown,
        maintenanceMessage: record.maintenanceMessage,
        enabledAt: record.enabledAt,
        disabledAt: record.disabledAt,
        scheduledStart: record.scheduledStart,
        scheduledEnd: record.scheduledEnd,
        updatedBy: record.updatedBy,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      };
    } catch (err: any) {
      this.logger.warn(`Could not sync SystemStatus from database: ${err.message}. Using in-memory status.`);
    }
    return this.cachedStatus;
  }

  /**
   * Fast sync getter used by request protection guards.
   */
  getCachedStatus(): SystemStatusState {
    return this.cachedStatus;
  }

  /**
   * Returns formatted system status (OPERATIONAL | MAINTENANCE | LOCKDOWN).
   */
  async getSystemStatus(): Promise<{
    mode: 'OPERATIONAL' | 'MAINTENANCE' | 'LOCKDOWN';
    message?: string;
    reason?: string;
    estimatedEndTime?: string;
    updatedAt?: Date;
    updatedBy?: any;
    config: SystemStatusState;
  }> {
    await this.refreshCache();
    let mode: 'OPERATIONAL' | 'MAINTENANCE' | 'LOCKDOWN' = 'OPERATIONAL';
    if (this.cachedStatus.emergencyLockdown) {
      mode = 'LOCKDOWN';
    } else if (this.cachedStatus.maintenanceMode) {
      mode = 'MAINTENANCE';
    }

    return {
      mode,
      message: this.cachedStatus.maintenanceMessage || undefined,
      reason: this.activeReason,
      estimatedEndTime: this.cachedStatus.scheduledEnd?.toISOString() || undefined,
      updatedAt: this.cachedStatus.updatedAt,
      config: this.cachedStatus,
    };
  }

  /**
   * Public-facing status representation.
   */
  async getPublicStatus() {
    const status = await this.getSystemStatus();
    return {
      mode: status.mode,
      message: status.message,
      reason: status.reason,
      estimatedEndTime: status.estimatedEndTime,
      updatedAt: status.updatedAt,
    };
  }

  /**
   * Returns current full system status.
   */
  async getStatus(): Promise<{
    status: 'OPERATIONAL' | 'MAINTENANCE_MODE' | 'EMERGENCY_LOCKDOWN';
    config: SystemStatusState;
  }> {
    await this.refreshCache();
    let status: 'OPERATIONAL' | 'MAINTENANCE_MODE' | 'EMERGENCY_LOCKDOWN' = 'OPERATIONAL';
    if (this.cachedStatus.emergencyLockdown) {
      status = 'EMERGENCY_LOCKDOWN';
    } else if (this.cachedStatus.maintenanceMode) {
      status = 'MAINTENANCE_MODE';
    }

    return {
      status,
      config: this.cachedStatus,
    };
  }

  /**
   * Enables maintenance mode.
   */
  async enableMaintenance(
    adminUserOrId: any,
    dtoOrAdminUser?: any,
    ipAddress?: string | null,
    userAgent?: string | null,
  ): Promise<any> {
    let adminUserId: string;
    let dto: EnableMaintenanceDto;

    if (typeof adminUserOrId === 'string') {
      adminUserId = adminUserOrId;
      dto = dtoOrAdminUser || {};
    } else {
      dto = adminUserOrId || {};
      adminUserId = dtoOrAdminUser?.id || dtoOrAdminUser?.sub || 'system-admin';
    }

    const prisma = this.prismaService.prisma;
    const now = new Date();

    // Refresh cache to ensure valid DB record ID
    await this.refreshCache();

    const previousState = { ...this.cachedStatus };

    const message = dto.message?.trim() || 'Rwanda E-Pharmacy is temporarily undergoing scheduled maintenance.';
    if (dto.reason) {
      this.activeReason = dto.reason.trim();
    }
    const scheduledEnd = dto.estimatedEndTime ? new Date(dto.estimatedEndTime) : null;

    let updated;
    try {
      updated = await prisma.systemStatus.update({
        where: { id: this.cachedStatus.id },
        data: {
          maintenanceMode: true,
          maintenanceMessage: message,
          enabledAt: now,
          scheduledEnd,
          updatedBy: adminUserId,
        },
      });
    } catch {
      const current = await prisma.systemStatus.findFirst({ orderBy: { createdAt: 'desc' } });
      if (current) {
        updated = await prisma.systemStatus.update({
          where: { id: current.id },
          data: {
            maintenanceMode: true,
            maintenanceMessage: message,
            enabledAt: now,
            scheduledEnd,
            updatedBy: adminUserId,
          },
        });
      } else {
        updated = await prisma.systemStatus.create({
          data: {
            maintenanceMode: true,
            maintenanceMessage: message,
            enabledAt: now,
            scheduledEnd,
            updatedBy: adminUserId,
          },
        });
      }
    }

    this.cachedStatus = {
      id: updated.id,
      maintenanceMode: updated.maintenanceMode,
      emergencyLockdown: updated.emergencyLockdown,
      maintenanceMessage: updated.maintenanceMessage,
      enabledAt: updated.enabledAt,
      disabledAt: updated.disabledAt,
      scheduledStart: updated.scheduledStart,
      scheduledEnd: updated.scheduledEnd,
      updatedBy: updated.updatedBy,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };

    await this.auditLogsService.log({
      userId: adminUserId,
      action: 'SYSTEM_MAINTENANCE_ENABLED',
      entityType: 'SystemStatus',
      entityId: updated.id,
      changes: {
        previousState: { maintenanceMode: previousState.maintenanceMode },
        newState: { maintenanceMode: true, message },
        reason: dto.reason || message,
      },
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
    });

    const currentStatus = await this.getSystemStatus();
    return {
      systemStatus: currentStatus,
      config: this.cachedStatus,
    };
  }

  /**
   * Disables maintenance mode.
   */
  async disableMaintenance(
    adminUserOrId: any,
    dtoOrAdminUser?: any,
    ipAddress?: string | null,
    userAgent?: string | null,
  ): Promise<any> {
    let adminUserId: string;
    let dto: DisableMaintenanceDto;

    if (typeof adminUserOrId === 'string') {
      adminUserId = adminUserOrId;
      dto = dtoOrAdminUser || {};
    } else {
      dto = adminUserOrId || {};
      adminUserId = dtoOrAdminUser?.id || dtoOrAdminUser?.sub || 'system-admin';
    }

    const prisma = this.prismaService.prisma;
    const now = new Date();

    // Refresh cache to ensure valid DB record ID
    await this.refreshCache();

    const previousState = { ...this.cachedStatus };

    const reason = dto.reason?.trim() || 'System maintenance completed.';
    this.activeReason = undefined;

    let updated;
    try {
      updated = await prisma.systemStatus.update({
        where: { id: this.cachedStatus.id },
        data: {
          maintenanceMode: false,
          emergencyLockdown: false,
          disabledAt: now,
          scheduledEnd: null,
          updatedBy: adminUserId,
        },
      });
    } catch {
      const current = await prisma.systemStatus.findFirst({ orderBy: { createdAt: 'desc' } });
      if (current) {
        updated = await prisma.systemStatus.update({
          where: { id: current.id },
          data: {
            maintenanceMode: false,
            emergencyLockdown: false,
            disabledAt: now,
            scheduledEnd: null,
            updatedBy: adminUserId,
          },
        });
      } else {
        updated = await prisma.systemStatus.create({
          data: {
            maintenanceMode: false,
            emergencyLockdown: false,
            disabledAt: now,
            scheduledEnd: null,
            updatedBy: adminUserId,
          },
        });
      }
    }

    this.cachedStatus = {
      id: updated.id,
      maintenanceMode: updated.maintenanceMode,
      emergencyLockdown: updated.emergencyLockdown,
      maintenanceMessage: updated.maintenanceMessage,
      enabledAt: updated.enabledAt,
      disabledAt: updated.disabledAt,
      scheduledStart: updated.scheduledStart,
      scheduledEnd: updated.scheduledEnd,
      updatedBy: updated.updatedBy,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };

    await this.auditLogsService.log({
      userId: adminUserId,
      action: 'SYSTEM_MAINTENANCE_DISABLED',
      entityType: 'SystemStatus',
      entityId: updated.id,
      changes: {
        previousState: { maintenanceMode: previousState.maintenanceMode, emergencyLockdown: previousState.emergencyLockdown },
        newState: { maintenanceMode: false, emergencyLockdown: false },
        reason,
      },
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
    });

    const currentStatus = await this.getSystemStatus();
    return {
      systemStatus: currentStatus,
      config: this.cachedStatus,
    };
  }

  /**
   * Resumes normal operations (alias to disableMaintenance).
   */
  async resumeNormalOperation(
    adminUserOrDto: any,
    dtoOrAdminUser?: any,
    ipAddress?: string | null,
    userAgent?: string | null,
  ): Promise<any> {
    return this.disableMaintenance(adminUserOrDto, dtoOrAdminUser, ipAddress, userAgent);
  }

  /**
   * Triggers Emergency Lockdown.
   */
  async enableEmergencyLockdown(
    adminUserOrDto: any,
    dtoOrAdminUser?: any,
    ipAddress?: string | null,
    userAgent?: string | null,
  ): Promise<any> {
    let adminUserId: string;
    let dto: EmergencyLockdownDto;

    if (typeof adminUserOrDto === 'string') {
      adminUserId = adminUserOrDto;
      dto = dtoOrAdminUser || { reason: 'Emergency Lockdown' };
    } else {
      dto = adminUserOrDto || { reason: 'Emergency Lockdown' };
      adminUserId = dtoOrAdminUser?.id || dtoOrAdminUser?.sub || 'system-admin';
    }

    const prisma = this.prismaService.prisma;
    const now = new Date();

    // Always refresh cache first to ensure we have a valid DB record ID
    await this.refreshCache();

    const previousState = { ...this.cachedStatus };
    this.activeReason = dto.reason;

    let updated;
    try {
      updated = await prisma.systemStatus.update({
        where: { id: this.cachedStatus.id },
        data: {
          emergencyLockdown: true,
          maintenanceMode: true,
          enabledAt: now,
          updatedBy: adminUserId,
        },
      });
    } catch (primaryErr: any) {
      this.logger.warn(`Primary lockdown update failed (id=${this.cachedStatus.id}): ${primaryErr.message}`);
      try {
        const current = await prisma.systemStatus.findFirst({ orderBy: { createdAt: 'desc' } });
        if (current) {
          updated = await prisma.systemStatus.update({
            where: { id: current.id },
            data: {
              emergencyLockdown: true,
              maintenanceMode: true,
              enabledAt: now,
              updatedBy: adminUserId,
            },
          });
        } else {
          updated = await prisma.systemStatus.create({
            data: {
              emergencyLockdown: true,
              maintenanceMode: true,
              enabledAt: now,
              updatedBy: adminUserId,
            },
          });
        }
      } catch (fallbackErr: any) {
        this.logger.error(`Fallback lockdown update also failed: ${fallbackErr.message}`);
        throw fallbackErr;
      }
    }

    this.cachedStatus = {
      id: updated.id,
      maintenanceMode: updated.maintenanceMode,
      emergencyLockdown: updated.emergencyLockdown,
      maintenanceMessage: updated.maintenanceMessage,
      enabledAt: updated.enabledAt,
      disabledAt: updated.disabledAt,
      scheduledStart: updated.scheduledStart,
      scheduledEnd: updated.scheduledEnd,
      updatedBy: updated.updatedBy,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };

    try {
      await this.auditLogsService.log({
        userId: adminUserId,
        action: 'SYSTEM_EMERGENCY_LOCKDOWN',
        entityType: 'SystemStatus',
        entityId: updated.id,
        changes: {
          previousState: { emergencyLockdown: previousState.emergencyLockdown },
          newState: { emergencyLockdown: true, maintenanceMode: true },
          reason: dto.reason,
        },
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ?? null,
      });
    } catch (auditErr: any) {
      this.logger.error(`Failed to write lockdown audit log: ${auditErr.message}`);
      // Don't fail the lockdown itself if audit logging fails
    }

    const currentStatus = await this.getSystemStatus();
    return {
      systemStatus: currentStatus,
      config: this.cachedStatus,
    };
  }

  /**
   * Lifts Emergency Lockdown.
   */
  async disableEmergencyLockdown(
    adminUserId: string,
    dto: EmergencyUnlockDto,
    ipAddress?: string | null,
    userAgent?: string | null,
  ): Promise<any> {
    return this.disableMaintenance(adminUserId, dto, ipAddress, userAgent);
  }

  /**
   * Schedules a maintenance window.
   */
  async scheduleMaintenance(
    adminUserId: string,
    dto: ScheduleMaintenanceDto,
    ipAddress?: string | null,
    userAgent?: string | null,
  ): Promise<SystemStatusState> {
    const prisma = this.prismaService.prisma;
    const start = new Date(dto.scheduledStart);
    const end = new Date(dto.scheduledEnd);
    const message = dto.message?.trim() || `Scheduled maintenance from ${start.toLocaleString()} to ${end.toLocaleString()}`;

    let updated;
    try {
      updated = await prisma.systemStatus.update({
        where: { id: this.cachedStatus.id },
        data: {
          scheduledStart: start,
          scheduledEnd: end,
          maintenanceMessage: message,
          updatedBy: adminUserId,
        },
      });
    } catch {
      const current = await prisma.systemStatus.findFirst({ orderBy: { createdAt: 'desc' } });
      if (current) {
        updated = await prisma.systemStatus.update({
          where: { id: current.id },
          data: {
            scheduledStart: start,
            scheduledEnd: end,
            maintenanceMessage: message,
            updatedBy: adminUserId,
          },
        });
      } else {
        updated = await prisma.systemStatus.create({
          data: {
            scheduledStart: start,
            scheduledEnd: end,
            maintenanceMessage: message,
            updatedBy: adminUserId,
          },
        });
      }
    }

    this.cachedStatus = {
      id: updated.id,
      maintenanceMode: updated.maintenanceMode,
      emergencyLockdown: updated.emergencyLockdown,
      maintenanceMessage: updated.maintenanceMessage,
      enabledAt: updated.enabledAt,
      disabledAt: updated.disabledAt,
      scheduledStart: updated.scheduledStart,
      scheduledEnd: updated.scheduledEnd,
      updatedBy: updated.updatedBy,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };

    await this.auditLogsService.log({
      userId: adminUserId,
      action: 'SYSTEM_MAINTENANCE_SCHEDULED',
      entityType: 'SystemStatus',
      entityId: updated.id,
      changes: {
        scheduledStart: start.toISOString(),
        scheduledEnd: end.toISOString(),
        message,
      },
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
    });

    return this.cachedStatus;
  }
}
