export interface SendSmsOptions {
  toNumber: string;
  message: string;
  callbackUrl?: string;
}

export type SmsDeliveryStatus = 'SENT' | 'DELIVERED' | 'FAILED';

export interface SmsSendResult {
  providerMessageId: string;
  status: SmsDeliveryStatus;
  rawResponse?: unknown;
  error?: string;
}

export interface ISmsProvider {
  readonly name: string;
  send(options: SendSmsOptions): Promise<SmsSendResult>;
}

export const SMS_PROVIDER_TOKEN = 'SMS_PROVIDER_TOKEN';
