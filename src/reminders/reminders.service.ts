import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateReminderScheduleDto } from './dto/reminders.dto';
import { UserRole, ReminderStatus } from '@generated/prisma';
import { validateUuid, sanitizeDeep, validateDate } from '../common/security/security.util';

interface AuthenticatedUser {
  id: string;
  role: UserRole;
}

@Injectable()
export class RemindersService {
  constructor(private prismaService: PrismaService) { }

  async createSchedule(user: AuthenticatedUser, dto: CreateReminderScheduleDto) {
    const prisma = this.prismaService.prisma;
    const safeDto = sanitizeDeep(dto);

    const startDate = validateDate((safeDto as any).startDate, 'startDate');
    const endDate = validateDate((safeDto as any).endDate, 'endDate');
    const { startDate: _s, endDate: _e, patientId, medicineId, medicineName, times, timeOfDay, frequency, dosage, notes, pharmacistInstructions, ...restDto } = safeDto as any;

    let safePatientId = patientId ? validateUuid(patientId, 'patientId') : undefined;
    if (user.role === UserRole.PATIENT) {
      const currentPatient = await prisma.patient.findFirst({ where: { userId: user.id } });
      if (!currentPatient) throw new NotFoundException('Patient profile not found');
      safePatientId = currentPatient.id;
    } else if (user.role !== UserRole.PHARMACIST) {
      throw new ForbiddenException('Only patients and pharmacists can create medication reminders');
    }

    let safeMedicineId = medicineId ? validateUuid(medicineId, 'medicineId') : undefined;
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
      if (!medicine) throw new NotFoundException(`Medicine not found: ${medicineName}`);
      safeMedicineId = medicine.id;
    }
    if (!safePatientId) throw new BadRequestException('patientId must be provided');
    if (!safeMedicineId) throw new BadRequestException('medicineId or medicineName must be provided');
    if (!startDate) throw new BadRequestException('startDate must be provided');

    const scheduleTimes = timeOfDay || times;
    if (!scheduleTimes?.length) throw new BadRequestException('timeOfDay or times must be provided');
    const scheduleEndDate = endDate || new Date(startDate.getTime() + 365 * 24 * 60 * 60 * 1000);

    // Verify the patient exists
    const patient = await prisma.patient.findUnique({ where: { id: safePatientId } });
    if (!patient) throw new NotFoundException('Patient profile not found');

    return prisma.reminderSchedule.create({
      data: {
        ...restDto,
        patientId: safePatientId,
        medicineId: safeMedicineId,
        dosage: dosage || 'As directed',
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
      const patient = await prisma.patient.findFirst({ where: { userId: user.id } });
      if (!patient) throw new NotFoundException('Patient profile not found');
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
        include: { medicine: true, prescription: true, patient: { include: { user: true } } },
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
        include: { medicine: true, prescription: true, patient: { include: { user: true } } },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (user.role === UserRole.GOVERNMENT) {
      const totalSchedules = await prisma.reminderSchedule.count();
      const activeSchedules = await prisma.reminderSchedule.count({
        where: { endDate: { gt: new Date() } },
      });
      const totalLogs = await prisma.reminderLog.count();
      const completedLogs = await prisma.reminderLog.count({ where: { status: ReminderStatus.COMPLETED } });
      const adherenceRate = totalLogs > 0 ? Math.round((completedLogs / totalLogs) * 100) : 0;
      return {
        aggregatedAnalytics: true,
        totalSchedules,
        activeSchedules,
        totalLogs,
        completedLogs,
        adherenceRatePercent: adherenceRate,
      };
    }

    throw new ForbiddenException('Insufficient permissions to access schedules');
  }

  async getMySchedules(userId: string) {
    const prisma = this.prismaService.prisma;
    const safeUserId = validateUuid(userId, 'userId');
    const patient = await prisma.patient.findFirst({ where: { userId: safeUserId } });
    if (!patient) throw new NotFoundException('Patient profile not found');
    return prisma.reminderSchedule.findMany({
      where: { patientId: patient.id },
      include: { medicine: true, prescription: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markIntake(user: AuthenticatedUser, logId: string) {
    const prisma = this.prismaService.prisma;
    const safeUserId = validateUuid(user.id, 'userId');
    const safeLogId = validateUuid(logId, 'logId');

    if (user.role !== UserRole.PATIENT) {
      throw new ForbiddenException('Only patients can mark medication intake');
    }

    const patient = await prisma.patient.findFirst({ where: { userId: safeUserId } });
    if (!patient) throw new NotFoundException('Patient profile not found');

    const log = await prisma.reminderLog.findUnique({
      where: { id: safeLogId },
      include: { schedule: true },
    });
    if (!log) throw new NotFoundException('Reminder log not found');
    if (log.schedule.patientId !== patient.id) {
      throw new ForbiddenException('This reminder log does not belong to you');
    }

    return prisma.reminderLog.update({
      where: { id: safeLogId },
      data: { status: ReminderStatus.COMPLETED, sentAt: new Date() },
    });
  }

  async getLogs(user: AuthenticatedUser) {
    const prisma = this.prismaService.prisma;
    const safeUserId = validateUuid(user.id, 'userId');
    const patient = await prisma.patient.findFirst({ where: { userId: safeUserId } });
    if (!patient) throw new NotFoundException('Patient profile not found');

    return prisma.reminderLog.findMany({
      where: { schedule: { patientId: patient.id } },
      include: { schedule: { include: { medicine: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
