import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  CreateReminderScheduleDto,
  UpdateReminderScheduleDto,
  ReminderLogQueryDto,
  DeliveryStatusWebhookDto,
  InboundSmsWebhookDto,
} from './dto/reminders.dto';
import { UserRole, ReminderStatus, NotificationType } from '@generated/prisma';
import {
  validateUuid,
  sanitizeDeep,
  validateDate,
} from '../common/security/security.util';

interface AuthenticatedUser {
  id: string;
  role: UserRole;
}

@Injectable()
export class RemindersService {
  constructor(private prismaService: PrismaService) { }

  private async getPatientFromUser(prisma: any, userId: string) {
    const patient = await prisma.patient.findFirst({ where: { userId } });
    if (!patient) throw new NotFoundException('Patient profile not found');
    return patient;
  }

  private computeAdherence(logs: any[]) {
    const totalEligible = logs.filter(
      (log) => ![ReminderStatus.CANCELLED].includes(log.status),
    ).length;
    const completed = logs.filter(
      (log) => log.status === ReminderStatus.COMPLETED,
    ).length;
    const missed = logs.filter(
      (log) => log.status === ReminderStatus.MISSED,
    ).length;
    const skipped = logs.filter(
      (log) => log.status === ReminderStatus.SKIPPED,
    ).length;
    const adherencePercentage =
      totalEligible > 0
        ? Number(((completed / totalEligible) * 100).toFixed(2))
        : 0;
    return {
      scheduledDoses: totalEligible,
      completedDoses: completed,
      missedDoses: missed,
      skippedDoses: skipped,
      adherencePercentage,
    };
  }

  async createSchedule(
    user: AuthenticatedUser,
    dto: CreateReminderScheduleDto,
  ) {
    const prisma = this.prismaService.prisma;
    const safeDto = sanitizeDeep(dto);

    const startDate = validateDate((safeDto as any).startDate, 'startDate');
    const endDate = validateDate((safeDto as any).endDate, 'endDate');
    const {
      startDate: _s,
      endDate: _e,
      patientId,
      medicineId,
      medicineName,
      times,
      timeOfDay,
      frequency,
      dosage,
      notes,
      pharmacistInstructions,
      channel,
      ...restDto
    } = safeDto as any;

    let safePatientId = patientId
      ? validateUuid(patientId, 'patientId')
      : undefined;
    if (user.role === UserRole.PATIENT) {
      const currentPatient = await prisma.patient.findFirst({
        where: { userId: user.id },
      });
      if (!currentPatient)
        throw new NotFoundException('Patient profile not found');
      safePatientId = currentPatient.id;
    } else if (user.role !== UserRole.PHARMACIST) {
      throw new ForbiddenException(
        'Only patients and pharmacists can create medication reminders',
      );
    }

    let safeMedicineId = medicineId
      ? validateUuid(medicineId, 'medicineId')
      : undefined;
    if (!safeMedicineId && medicineName) {
      const medicine = await prisma.medicine.findFirst({
        where: {
          OR: [
            { tradeName: { equals: medicineName, mode: 'insensitive' } },
            { tradeName: { contains: medicineName, mode: 'insensitive' } },
            { genericName: { equals: medicineName, mode: 'insensitive' } },
            { genericName: { contains: medicineName, mode: 'insensitive' } },
          ],
        },
      });
      if (!medicine)
        throw new NotFoundException(`Medicine not found: ${medicineName}`);
      safeMedicineId = medicine.id;
    }
    if (!safePatientId)
      throw new BadRequestException('patientId must be provided');
    if (!safeMedicineId)
      throw new BadRequestException(
        'medicineId or medicineName must be provided',
      );
    if (!startDate) throw new BadRequestException('startDate must be provided');

    const scheduleTimes = timeOfDay || times;
    if (!scheduleTimes?.length)
      throw new BadRequestException('timeOfDay or times must be provided');
    const scheduleEndDate =
      endDate || new Date(startDate.getTime() + 365 * 24 * 60 * 60 * 1000);

    const patient = await prisma.patient.findUnique({
      where: { id: safePatientId },
    });
    if (!patient) throw new NotFoundException('Patient profile not found');

    return prisma.reminderSchedule.create({
      data: {
        ...restDto,
        patientId: safePatientId,
        medicineId: safeMedicineId,
        dosage: dosage || 'As directed',
        channel: channel || NotificationType.SMS,
        startDate,
        endDate: scheduleEndDate,
        timeOfDay: scheduleTimes,
        ...(frequency === 'weekly' ? { intervalHours: 168 } : {}),
      },
    });
  }

  async getSchedules(user: AuthenticatedUser) {
    const prisma = this.prismaService.prisma;

    if (user.role === UserRole.PATIENT) {
      const patient = await this.getPatientFromUser(prisma, user.id);
      return prisma.reminderSchedule.findMany({
        where: { patientId: patient.id },
        include: { medicine: true, prescription: true },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (user.role === UserRole.PHARMACY_OWNER) {
      const ownedPharmacies = await prisma.pharmacy.findMany({
        where: { ownerId: user.id },
        select: { id: true },
      });
      const pharmacyIds = ownedPharmacies.map((p) => p.id);
      const inventoryItems = await prisma.inventory.findMany({
        where: { pharmacyId: { in: pharmacyIds }, deletedAt: null },
        select: { medicineId: true },
      });
      const medicineIds = [...new Set(inventoryItems.map((i) => i.medicineId))];
      return prisma.reminderSchedule.findMany({
        where: { medicineId: { in: medicineIds } },
        include: {
          medicine: true,
          prescription: true,
          patient: { include: { user: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (user.role === UserRole.PHARMACIST) {
      const staff = await prisma.pharmacyEmployee.findMany({
        where: { userId: user.id, role: UserRole.PHARMACIST },
        select: { pharmacyId: true },
      });
      const pharmacyIds = staff.map((s) => s.pharmacyId);
      const inventoryItems = await prisma.inventory.findMany({
        where: { pharmacyId: { in: pharmacyIds }, deletedAt: null },
        select: { medicineId: true },
      });
      const medicineIds = [...new Set(inventoryItems.map((i) => i.medicineId))];
      return prisma.reminderSchedule.findMany({
        where: { medicineId: { in: medicineIds } },
        include: {
          medicine: true,
          prescription: true,
          patient: { include: { user: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (user.role === UserRole.GOVERNMENT) {
      const totalSchedules = await prisma.reminderSchedule.count();
      const activeSchedules = await prisma.reminderSchedule.count({
        where: { endDate: { gt: new Date() } },
      });
      const totalLogs = await prisma.reminderLog.count();
      const completedLogs = await prisma.reminderLog.count({
        where: { status: ReminderStatus.COMPLETED },
      });
      const adherenceRate =
        totalLogs > 0 ? Math.round((completedLogs / totalLogs) * 100) : 0;
      return {
        aggregatedAnalytics: true,
        totalSchedules,
        activeSchedules,
        totalLogs,
        completedLogs,
        adherenceRatePercent: adherenceRate,
      };
    }

    throw new ForbiddenException(
      'Insufficient permissions to access schedules',
    );
  }

  async getMySchedules(userId: string) {
    const prisma = this.prismaService.prisma;
    const safeUserId = validateUuid(userId, 'userId');
    const patient = await this.getPatientFromUser(prisma, safeUserId);
    return prisma.reminderSchedule.findMany({
      where: { patientId: patient.id },
      include: { medicine: true, prescription: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateSchedule(
    user: AuthenticatedUser,
    id: string,
    dto: UpdateReminderScheduleDto,
  ) {
    const prisma = this.prismaService.prisma;
    if (user.role !== UserRole.PATIENT)
      throw new ForbiddenException('Only patients can update reminders');
    const patient = await this.getPatientFromUser(
      prisma,
      validateUuid(user.id, 'userId'),
    );
    const safeId = validateUuid(id, 'id');
    const schedule = await prisma.reminderSchedule.findUnique({
      where: { id: safeId },
    });
    if (!schedule || schedule.patientId !== patient.id)
      throw new NotFoundException('Reminder not found');
    const safeDto = sanitizeDeep(dto) as any;
    const data: any = {};
    if (safeDto.times !== undefined) data.timeOfDay = safeDto.times;
    if (safeDto.startDate !== undefined)
      data.startDate = validateDate(safeDto.startDate, 'startDate');
    if (safeDto.endDate !== undefined)
      data.endDate = validateDate(safeDto.endDate, 'endDate');
    if (safeDto.isActive === false) data.endDate = new Date();
    if (safeDto.isActive === true && safeDto.endDate === undefined)
      data.endDate = new Date('2099-12-31T23:59:59.999Z');
    return prisma.reminderSchedule.update({ where: { id: safeId }, data });
  }

  async deleteSchedule(user: AuthenticatedUser, id: string) {
    const prisma = this.prismaService.prisma;
    if (user.role !== UserRole.PATIENT)
      throw new ForbiddenException('Only patients can delete reminders');
    const patient = await this.getPatientFromUser(
      prisma,
      validateUuid(user.id, 'userId'),
    );
    const safeId = validateUuid(id, 'id');
    const schedule = await prisma.reminderSchedule.findUnique({
      where: { id: safeId },
    });
    if (!schedule || schedule.patientId !== patient.id)
      throw new NotFoundException('Reminder not found');
    return prisma.reminderSchedule.delete({ where: { id: safeId } });
  }

  async markIntake(
    user: AuthenticatedUser,
    logId: string,
    confirmationSource: 'APP' | 'SMS' | 'VOICE' | 'IVR' | 'SYSTEM' = 'APP',
  ) {
    const prisma = this.prismaService.prisma;
    const safeUserId = validateUuid(user.id, 'userId');
    const safeLogId = validateUuid(logId, 'logId');

    if (user.role !== UserRole.PATIENT) {
      throw new ForbiddenException('Only patients can mark medication intake');
    }

    const patient = await this.getPatientFromUser(prisma, safeUserId);
    const log = await prisma.reminderLog.findUnique({
      where: { id: safeLogId },
      include: { schedule: true },
    });
    if (!log) throw new NotFoundException('Reminder log not found');
    if (log.schedule.patientId !== patient.id) {
      throw new ForbiddenException('This reminder log does not belong to you');
    }
    if (
      log.status === ReminderStatus.COMPLETED ||
      log.status === ReminderStatus.MISSED ||
      log.status === ReminderStatus.SKIPPED ||
      log.status === ReminderStatus.CANCELLED
    ) {
      throw new BadRequestException(
        'This reminder dose can no longer be updated',
      );
    }

    return prisma.reminderLog.update({
      where: { id: safeLogId },
      data: {
        status: ReminderStatus.COMPLETED,
        sentAt: log.sentAt ?? new Date(),
        confirmationSource,
        confirmationTime: new Date(),
      },
    });
  }

  async getLogs(
    user: AuthenticatedUser,
    query: ReminderLogQueryDto | number = 1,
    limitParam = 20,
  ) {
    const prisma = this.prismaService.prisma;
    const isObjectQuery = typeof query === 'object' && query !== null;
    const page = isObjectQuery
      ? Number(query.page) > 0
        ? Number(query.page)
        : 1
      : Number(query) > 0
        ? Number(query)
        : 1;
    const limit = isObjectQuery
      ? Math.min(Number(query.limit) > 0 ? Number(query.limit) : 20, 100)
      : Math.min(Number(limitParam) > 0 ? Number(limitParam) : 20, 100);

    const safeUserId = validateUuid(user.id, 'userId');
    const where: any = {};

    if (user.role === UserRole.PATIENT) {
      const patient = await this.getPatientFromUser(prisma, safeUserId);
      where.patientId = patient.id;
    } else if (
      user.role === UserRole.PHARMACIST ||
      user.role === UserRole.PHARMACY_OWNER ||
      user.role === UserRole.ADMIN ||
      user.role === UserRole.GOVERNMENT
    ) {
      if (isObjectQuery && query.patientId) {
        where.patientId = validateUuid(query.patientId, 'patientId');
      }
    } else {
      throw new ForbiddenException(
        'You do not have permission to view reminder logs',
      );
    }

    if (isObjectQuery && query.status) {
      where.status = query.status;
    }

    if (isObjectQuery && (query.startDate || query.endDate)) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = validateDate(query.startDate, 'startDate');
      }
      if (query.endDate) {
        const end = validateDate(query.endDate, 'endDate');
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const [data, total] = await Promise.all([
      prisma.reminderLog.findMany({
        where,
        include: {
          schedule: { include: { medicine: true } },
          patient: {
            select: {
              id: true,
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  phone: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.reminderLog.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async handleDeliveryStatusWebhook(dto: DeliveryStatusWebhookDto) {
    const prisma = this.prismaService.prisma;
    const providerReference = dto.id || dto.providerMessageId;

    if (!providerReference) {
      return {
        success: false,
        message: 'Missing message ID / provider reference in webhook payload',
      };
    }

    const rawStatus = (dto.status || '').toLowerCase();
    let mappedStatus: ReminderStatus = ReminderStatus.SENT;

    if (
      rawStatus === 'delivered' ||
      rawStatus === 'success' ||
      rawStatus === 'completed'
    ) {
      mappedStatus = ReminderStatus.DELIVERED;
    } else if (
      rawStatus === 'failed' ||
      rawStatus === 'rejected' ||
      rawStatus === 'undelivered'
    ) {
      mappedStatus = ReminderStatus.FAILED;
    } else if (
      rawStatus === 'sent' ||
      rawStatus === 'submitted' ||
      rawStatus === 'buffered' ||
      rawStatus === 'queued'
    ) {
      mappedStatus = ReminderStatus.SENT;
    }

    const log = await prisma.reminderLog.findFirst({
      where: { providerReference },
    });

    if (!log) {
      return {
        success: true,
        updated: false,
        message: `No reminder log found with providerReference: ${providerReference}`,
      };
    }

    // Do not downgrade a COMPLETED dose back to DELIVERED/SENT
    if (log.status === ReminderStatus.COMPLETED) {
      return {
        success: true,
        updated: false,
        logId: log.id,
        currentStatus: log.status,
        message: 'Dose already marked as COMPLETED by patient',
      };
    }

    const updated = await prisma.reminderLog.update({
      where: { id: log.id },
      data: {
        status: mappedStatus,
        error:
          mappedStatus === ReminderStatus.FAILED
            ? (dto.failureReason || dto.error || 'Provider delivery failure')
            : null,
      },
    });

    return {
      success: true,
      updated: true,
      logId: updated.id,
      previousStatus: log.status,
      newStatus: updated.status,
    };
  }

  async handleInboundSmsWebhook(dto: InboundSmsWebhookDto) {
    const prisma = this.prismaService.prisma;
    const rawFrom = (dto.from || dto.phoneNumber || '').trim();
    const rawText = (dto.text || dto.message || '').trim();

    if (!rawFrom || !rawText) {
      return {
        success: false,
        message: 'Inbound webhook payload missing sender phone number or text',
      };
    }

    // Check affirmative keywords (English and Kinyarwanda)
    const isAffirmative =
      /^(YES|Y|TAKEN|DONE|1|OK|EGO|NAYIFASHE|NAKIRIYE)(\b|!|\.)/i.test(rawText);

    if (!isAffirmative) {
      return {
        success: true,
        confirmed: false,
        message: `Inbound message "${rawText}" is not a recognized confirmation keyword`,
      };
    }

    // Normalize phone number: e.g. +250788123456 -> matches 0788123456, 250788123456, +250788123456
    const digitsOnly = rawFrom.replace(/\D/g, '');
    const phoneCandidates = [rawFrom];
    if (digitsOnly.startsWith('250')) {
      phoneCandidates.push('+' + digitsOnly);
      phoneCandidates.push('0' + digitsOnly.slice(3));
      phoneCandidates.push(digitsOnly);
    } else if (digitsOnly.startsWith('07')) {
      phoneCandidates.push('+250' + digitsOnly.slice(1));
      phoneCandidates.push('250' + digitsOnly.slice(1));
      phoneCandidates.push(digitsOnly);
    }

    const user = await prisma.user.findFirst({
      where: {
        phone: { in: phoneCandidates },
      },
      include: { patient: true },
    });

    if (!user || !user.patient) {
      return {
        success: true,
        confirmed: false,
        message: `No registered patient found with phone number ${rawFrom}`,
      };
    }

    // Find the most recent active/due reminder log for this patient within the last 12 hours
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
    const activeLog = await prisma.reminderLog.findFirst({
      where: {
        patientId: user.patient.id,
        status: {
          in: [
            ReminderStatus.SENT,
            ReminderStatus.DELIVERED,
            ReminderStatus.PENDING,
            ReminderStatus.QUEUED,
          ],
        },
        createdAt: { gte: twelveHoursAgo },
      },
      include: {
        schedule: {
          include: { medicine: { select: { tradeName: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!activeLog) {
      return {
        success: true,
        confirmed: false,
        message: `No pending or delivered reminder found in the active window for patient ${user.patient.id}`,
      };
    }

    const confirmedLog = await prisma.reminderLog.update({
      where: { id: activeLog.id },
      data: {
        status: ReminderStatus.COMPLETED,
        confirmationSource: 'SMS',
        confirmationTime: new Date(),
      },
    });

    return {
      success: true,
      confirmed: true,
      logId: confirmedLog.id,
      patientId: user.patient.id,
      medicine: activeLog.schedule.medicine.tradeName,
      confirmationTime: confirmedLog.confirmationTime,
    };
  }

  async getAdherenceSummary(
    user: AuthenticatedUser,
    period: 'day' | 'week' | 'month' = 'month',
    startDate?: string,
    endDate?: string,
  ) {
    const prisma = this.prismaService.prisma;
    if (user.role !== UserRole.PATIENT) {
      throw new ForbiddenException(
        'Only patients can access their adherence summary',
      );
    }

    const patient = await this.getPatientFromUser(
      prisma,
      validateUuid(user.id, 'userId'),
    );
    const lowerBound = startDate
      ? validateDate(startDate, 'startDate')
      : undefined;
    const upperBound = endDate ? validateDate(endDate, 'endDate') : undefined;
    const where: any = { schedule: { patientId: patient.id } };
    if (lowerBound || upperBound) {
      where.createdAt = {};
      if (lowerBound) where.createdAt.gte = lowerBound;
      if (upperBound) where.createdAt.lte = upperBound;
    }

    const logs = await prisma.reminderLog.findMany({
      where,
      include: {
        schedule: {
          select: {
            id: true,
            dosage: true,
            medicine: { select: { tradeName: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const summary = this.computeAdherence(logs);
    return { period, ...summary, generatedAt: new Date().toISOString() };
  }
}
