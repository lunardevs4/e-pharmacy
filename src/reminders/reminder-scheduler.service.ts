import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationType, ReminderStatus } from '@generated/prisma';
import { EmailService } from '../common/email/email.service';
import { CommunicationService } from '../common/communication/communication.service';
import { buildMedicationReminderMessage } from './helpers/reminder-message.helper';

@Injectable()
export class ReminderSchedulerService {
  private readonly logger = new Logger(ReminderSchedulerService.name);

  constructor(
    private prismaService: PrismaService,
    private emailService: EmailService,
    private communicationService: CommunicationService,
  ) { }

  private isTransientDbError(error: unknown) {
    const err = error as { code?: string; message?: string };
    const message = err?.message || '';
    return (
      err?.code === 'ECONNRESET' ||
      err?.code === 'ETIMEDOUT' ||
      message.includes('socket disconnected') ||
      message.includes('TLS connection was established')
    );
  }

  private async runWithReconnect<T>(operation: () => Promise<T>) {
    try {
      return await operation();
    } catch (error) {
      if (!this.isTransientDbError(error)) {
        throw error;
      }

      this.logger.warn(
        `Reminder scheduler hit a transient DB error, reconnecting: ${(error as Error).message}`,
      );
      const prisma = this.prismaService.prisma;

      try {
        await prisma.$disconnect();
      } catch { }

      await prisma.$connect();
      return operation();
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async dispatchDueReminders() {
    await this.runWithReconnect(async () => {
      const prisma = this.prismaService.prisma;
      const now = new Date();
      const currentHHMM = now.toTimeString().slice(0, 5);
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(now);
      todayEnd.setHours(23, 59, 59, 999);

      const activeSchedules = await prisma.reminderSchedule.findMany({
        where: {
          startDate: { lte: now },
          endDate: { gte: now },
        },
        include: {
          patient: { include: { user: true } },
          medicine: { select: { id: true, tradeName: true } },
        },
      });

      if (activeSchedules.length === 0) return;
      const dueSchedules = activeSchedules.filter((schedule) =>
        schedule.timeOfDay.includes(currentHHMM),
      );
      if (dueSchedules.length === 0) return;

      this.logger.log(
        `[${currentHHMM}] Found ${dueSchedules.length} due reminder(s)`,
      );

      for (const schedule of dueSchedules) {
        try {
          const sameDayLog = await prisma.reminderLog.findFirst({
            where: {
              scheduleId: schedule.id,
              createdAt: { gte: todayStart, lte: todayEnd },
            },
          });

          if (sameDayLog) {
            const diffMs = Math.abs(
              now.getTime() - sameDayLog.createdAt.getTime(),
            );
            if (diffMs < 2 * 60 * 1000) {
              this.logger.debug(
                `Skipping duplicate reminder for schedule ${schedule.id} at ${currentHHMM}`,
              );
              continue;
            }
          }

          const patientUser = schedule.patient.user;
          const medicineName = schedule.medicine.tradeName;
          const message = buildMedicationReminderMessage({
            patientName: patientUser.firstName,
            medicineName,
            dosage: schedule.dosage,
            time: currentHHMM,
          });

          const smsResult = await this.communicationService.sendSms(
            patientUser.phone,
            message,
          );

          const status =
            smsResult.status === 'SENT' || smsResult.status === 'DELIVERED'
              ? ReminderStatus.SENT
              : ReminderStatus.FAILED;

          await prisma.reminderLog.create({
            data: {
              scheduleId: schedule.id,
              patientId: schedule.patientId,
              type: schedule.channel || NotificationType.SMS,
              status,
              sentAt: now,
              provider: smsResult.provider,
              providerReference: smsResult.providerReference,
              error:
                smsResult.status === 'FAILED'
                  ? (smsResult.error ?? 'Provider rejected the request')
                  : null,
            },
          });

          if (smsResult.status === 'FAILED') {
            this.logger.warn(
              `SMS reminder failed for schedule ${schedule.id}: ${smsResult.error ?? 'unknown error'}`,
            );
          }

          const preference = await prisma.systemSetting.findUnique({
            where: { key: `email_notifications:${patientUser.id}` },
          });
          const emailEnabled = preference
            ? JSON.parse(preference.value).reminders !== false
            : true;
          if (emailEnabled && patientUser.email) {
            await this.emailService.sendNotificationEmail(
              patientUser.email,
              `${patientUser.firstName} ${patientUser.lastName}`.trim(),
              'Medication Reminder',
              `${message} Please confirm within the advised window.`,
            );
          }

          this.logger.log(
            `Dispatched reminder for patient ${schedule.patientId} | medicine: ${medicineName} | time: ${currentHHMM} | ref: ${smsResult.providerReference ?? 'none'}`,
          );
        } catch (err) {
          this.logger.error(
            `Failed to dispatch reminder for schedule ${schedule.id}: ${(err as Error).message}`,
          );
          try {
            await prisma.reminderLog.create({
              data: {
                scheduleId: schedule.id,
                patientId: schedule.patientId,
                type: schedule.channel || NotificationType.SMS,
                status: ReminderStatus.FAILED,
                sentAt: now,
                error: (err as Error).message,
              },
            });
          } catch (logErr) {
            this.logger.error(
              `Could not write failure log for schedule ${schedule.id}: ${(logErr as Error).message}`,
            );
          }
        }
      }
    }).catch((error) => {
      this.logger.error(
        `Reminder dispatch run failed: ${(error as Error).message}`,
      );
    });
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async markMissedDoses() {
    await this.runWithReconnect(async () => {
      const prisma = this.prismaService.prisma;
      const now = new Date();
      const windowStart = new Date(now);
      windowStart.setDate(windowStart.getDate() - 1);
      windowStart.setHours(0, 0, 0, 0);
      const windowEnd = new Date(now);
      windowEnd.setDate(windowEnd.getDate() - 1);
      windowEnd.setHours(23, 59, 59, 999);

      const result = await prisma.reminderLog.updateMany({
        where: {
          status: {
            in: [
              ReminderStatus.PENDING,
              ReminderStatus.QUEUED,
              ReminderStatus.SENT,
              ReminderStatus.DELIVERED,
            ],
          },
          createdAt: { gte: windowStart, lte: windowEnd },
        },
        data: { status: ReminderStatus.MISSED },
      });

      if (result.count > 0) {
        this.logger.log(
          `Marked ${result.count} dose(s) as MISSED from yesterday`,
        );
      }
    }).catch((error) => {
      this.logger.error(
        `Mark missed doses run failed: ${(error as Error).message}`,
      );
    });
  }

  @Cron('*/5 * * * *')
  async retryFailedReminders() {
    await this.runWithReconnect(async () => {
      const prisma = this.prismaService.prisma;
      const maxRetries = Number(process.env.SMS_MAX_RETRIES) || 3;
      const now = new Date();
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

      const failedLogs = await prisma.reminderLog.findMany({
        where: {
          status: ReminderStatus.FAILED,
          type: NotificationType.SMS,
          confirmationTime: null,
          retryCount: { lt: maxRetries },
          createdAt: { gte: twoHoursAgo },
        },
        include: {
          schedule: {
            include: {
              medicine: { select: { tradeName: true } },
            },
          },
          patient: {
            include: {
              user: true,
            },
          },
        },
      });

      if (failedLogs.length === 0) return;
      this.logger.log(
        `Found ${failedLogs.length} failed reminder(s) eligible for retry evaluation`,
      );

      for (const log of failedLogs) {
        // Exponential backoff: attempt 0 -> 5m, attempt 1 -> 15m, attempt 2 -> 45m
        const backoffMinutes = Math.pow(3, log.retryCount) * 5;
        const eligibleAt = new Date(
          log.createdAt.getTime() + backoffMinutes * 60 * 1000,
        );
        if (now < eligibleAt) {
          continue;
        }

        const patientUser = log.patient.user;
        const medicineName = log.schedule.medicine.tradeName;
        const message = buildMedicationReminderMessage({
          patientName: patientUser.firstName,
          medicineName,
          dosage: log.schedule.dosage,
        });

        this.logger.log(
          `Retrying SMS reminder for log ${log.id} (attempt ${log.retryCount + 1}/${maxRetries}) to ${patientUser.phone}`,
        );

        const smsResult = await this.communicationService.sendSms(
          patientUser.phone,
          message,
        );

        if (smsResult.status === 'SENT' || smsResult.status === 'DELIVERED') {
          await prisma.reminderLog.update({
            where: { id: log.id },
            data: {
              status: ReminderStatus.SENT,
              sentAt: now,
              provider: smsResult.provider,
              providerReference: smsResult.providerReference,
              retryCount: log.retryCount + 1,
              error: null,
            },
          });
          this.logger.log(
            `Retry succeeded for reminder log ${log.id} | ref: ${smsResult.providerReference}`,
          );
        } else {
          const nextRetryCount = log.retryCount + 1;
          await prisma.reminderLog.update({
            where: { id: log.id },
            data: {
              retryCount: nextRetryCount,
              error: smsResult.error ?? 'Retry failed',
            },
          });
          if (nextRetryCount >= maxRetries) {
            this.logger.error(
              `Reminder log ${log.id} exhausted max retries (${maxRetries}). Permanent failure: ${smsResult.error}`,
            );
          }
        }
      }
    }).catch((error) => {
      this.logger.error(
        `Retry failed reminders run failed: ${(error as Error).message}`,
      );
    });
  }
}
