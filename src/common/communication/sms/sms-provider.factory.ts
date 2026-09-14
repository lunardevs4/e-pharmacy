import { ConfigService } from '@nestjs/config';
import { ISmsProvider } from './sms-provider.interface';
import { MockSmsProvider } from './mock-sms.provider';
import { AfricasTalkingSmsProvider } from './africas-talking-sms.provider';

export function smsProviderFactory(configService: ConfigService): ISmsProvider {
  const providerName = (
    configService.get<string>('SMS_PROVIDER') ??
    configService.get<string>('SMS_PROVIDER_MODE') ??
    'mock'
  ).toLowerCase();

  if (providerName === 'africastalking') {
    return new AfricasTalkingSmsProvider();
  }

  return new MockSmsProvider();
}
