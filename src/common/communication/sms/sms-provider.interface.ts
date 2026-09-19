export interface SendSmsOptions {
  toNumber: string;
  message: string;
  callbackUrl?: string;
}

export type SmsDeliveryStatus =
  | 'PENDING'
  | 'SUBMITTED'
  | 'QUEUED'
  | 'SENT'
  | 'DELIVERED'
  | 'FAILED'
  | 'UNKNOWN';

export interface SmsSendResult {
  internalMessageId: string;
  providerMessageId?: string;
  status: SmsDeliveryStatus;
  rawResponse?: unknown;
  error?: string;
}

export interface ISmsProvider {
  readonly name: string;
  send(options: SendSmsOptions): Promise<SmsSendResult>;
  getDeliveryStatus?(providerMessageId: string): Promise<SmsSendResult>;
}

export const SMS_PROVIDER_TOKEN = 'SMS_PROVIDER_TOKEN';

