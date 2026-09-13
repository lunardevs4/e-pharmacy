import { Global, Module } from '@nestjs/common';
import { MonitoringService } from './monitoring.service';

@Global()
@Module({ providers: [MonitoringService], exports: [MonitoringService] })
export class MonitoringModule {}
