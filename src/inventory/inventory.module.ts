import { Module } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { PrismaModule } from '../common/prisma/prisma.module';
import { EmailModule } from '../common/email/email.module';

@Module({
  imports: [PrismaModule, EmailModule],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
