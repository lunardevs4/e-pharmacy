import { Module, Global } from '@nestjs/common';
import { CommunicationService } from './communication.service';

@Global()
@Module({
  providers: [CommunicationService],
  exports: [CommunicationService],
})
export class CommunicationModule {}
