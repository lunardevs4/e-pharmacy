import { ConfigService } from '@nestjs/config';
import { ISmsProvider } from './sms-provider.interface';
import { MockSmsProvider } from './mock-sms.provider';
import { EsmsAfricaSmsProvider } from './esms-africa-sms.provider';

export function smsProviderFactory(configService: ConfigService): ISmsProvider {
  const providerName = (
    configService?.get<string>('SMS_PROVIDER') ??
    configService?.get<string>('SMS_PROVIDER_MODE') ??
    process.env.SMS_PROVIDER ??
    process.env.SMS_PROVIDER_MODE ??
    'esms'
  ).toLowerCase().trim();

  if (providerName === 'mock') {
    return new MockSmsProvider();
  }

  // Exclusive default SMS provider: eSMS Africa
  return new EsmsAfricaSmsProvider();
}
