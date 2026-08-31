import { Module } from '@nestjs/common';
import { RemindersService } from './reminders.service';
import { RemindersController } from './reminders.controller';
import { ReminderSchedulerService } from './reminder-scheduler.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { EmailModule } from '../common/email/email.module';

@Module({
  imports: [PrismaModule, EmailModule],
  controllers: [RemindersController],
  providers: [RemindersService, ReminderSchedulerService],
  exports: [RemindersService],
})
export class RemindersModule {}
