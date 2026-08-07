import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationType, ReminderStatus } from '@generated/prisma';

@Injectable()
export class ReminderSchedulerService {
  private readonly logger = new Logger(ReminderSchedulerService.name);

  constructor(private prismaService: PrismaService) {}

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

      this.logger.warn(`Reminder scheduler hit a transient DB error, reconnecting: ${(error as Error).message}`);
      const prisma = this.prismaService.prisma;

      try {
        await prisma.$disconnect();
      } catch {
        // Ignore disconnect errors and try a fresh connection below.
      }

      await prisma.$connect();
      return operation();
    }
  }

  /**
   * Runs every minute. Finds all active reminder schedules whose timeOfDay
   * matches the current HH:MM, creates a ReminderLog and an in-app Notification
   * for the patient — unless one has already been created for that dose today.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async dispatchDueReminders() {
    await this.runWithReconnect(async () => {
      const prisma = this.prismaService.prisma;
      const now = new Date();

      // Current time as "HH:MM" in local time (server timezone)
      const currentHHMM = now.toTimeString().slice(0, 5); // e.g. "08:00"

      // Window: start of today and end of today for dedup checks
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(now);
      todayEnd.setHours(23, 59, 59, 999);

      // Fetch all schedules that are currently active (today falls within start/end)
      const activeSchedules = await prisma.reminderSchedule.findMany({
        where: {
          startDate: { lte: now },
          endDate: { gte: now },
        },
        include: {
          patient: {
            include: { user: true },
          },
          medicine: {
            select: { id: true, name: true },
          },
        },
      });

      if (activeSchedules.length === 0) return;

      // Filter to schedules that have a dose due right now
      const dueSchedules = activeSchedules.filter((schedule) =>
        schedule.timeOfDay.includes(currentHHMM),
      );

      if (dueSchedules.length === 0) return;

      this.logger.log(
        `[${currentHHMM}] Found ${dueSchedules.length} due reminder(s)`,
      );

      for (const schedule of dueSchedules) {
        try {
          // Dedup: skip if a log already exists for this schedule + time slot today
          const existing = await prisma.reminderLog.findFirst({
            where: {
              scheduleId: schedule.id,
              createdAt: { gte: todayStart, lte: todayEnd },
              // Match logs created within a 2-minute window around this slot
              // to handle any edge cases with re-runs
            },
          });

          // Narrow dedup to within ±2 minutes of the current time
          if (existing) {
            const diffMs = Math.abs(
              now.getTime() - existing.createdAt.getTime(),
            );
            if (diffMs < 2 * 60 * 1000) {
              this.logger.debug(
                `Skipping duplicate reminder for schedule ${schedule.id} at ${currentHHMM}`,
              );
              continue;
            }
          }

          const patientUserId = schedule.patient.user.id;
          const medicineName = schedule.medicine.name;

          // Create the reminder log and notification in a transaction
          await prisma.$transaction([
            prisma.reminderLog.create({
              data: {
                scheduleId: schedule.id,
                patientId: schedule.patientId,
                type: NotificationType.IN_APP,
                status: ReminderStatus.SENT,
                sentAt: now,
              },
            }),
            prisma.notification.create({
              data: {
                userId: patientUserId,
                type: NotificationType.IN_APP,
                title: 'Medication Reminder',
                message: `Time to take your ${medicineName} — ${schedule.dosage}`,
              },
            }),
          ]);

          this.logger.log(
            `Dispatched reminder for patient ${schedule.patientId} | medicine: ${medicineName} | time: ${currentHHMM}`,
          );
        } catch (err) {
          // Log the failure and record it without crashing the loop
          this.logger.error(
            `Failed to dispatch reminder for schedule ${schedule.id}: ${(err as Error).message}`,
          );

          try {
            await prisma.reminderLog.create({
              data: {
                scheduleId: schedule.id,
                patientId: schedule.patientId,
                type: NotificationType.IN_APP,
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

  /**
   * Runs daily at midnight. Marks any PENDING/SENT logs from yesterday
   * that were never completed by the patient as MISSED.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async markMissedDoses() {
    await this.runWithReconnect(async () => {
      const prisma = this.prismaService.prisma;
      const now = new Date();

      const yesterdayStart = new Date(now);
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);
      yesterdayStart.setHours(0, 0, 0, 0);

      const yesterdayEnd = new Date(now);
      yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);
      yesterdayEnd.setHours(23, 59, 59, 999);

      const result = await prisma.reminderLog.updateMany({
        where: {
          status: { in: [ReminderStatus.SENT, ReminderStatus.PENDING] },
          createdAt: { gte: yesterdayStart, lte: yesterdayEnd },
        },
        data: { status: ReminderStatus.MISSED },
      });

      if (result.count > 0) {
        this.logger.log(`Marked ${result.count} dose(s) as MISSED from yesterday`);
      }
    }).catch((error) => {
      this.logger.error(
        `Mark missed doses run failed: ${(error as Error).message}`,
      );
    });
  }
}
