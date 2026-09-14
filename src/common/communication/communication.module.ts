import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommunicationService } from './communication.service';
import { SMS_PROVIDER_TOKEN } from './sms/sms-provider.interface';
import { smsProviderFactory } from './sms/sms-provider.factory';

@Global()
@Module({
  providers: [
    {
      provide: SMS_PROVIDER_TOKEN,
      inject: [ConfigService],
      useFactory: smsProviderFactory,
    },
    CommunicationService,
  ],
  exports: [SMS_PROVIDER_TOKEN, CommunicationService],
})
export class CommunicationModule {}

