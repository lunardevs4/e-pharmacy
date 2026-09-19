import { Injectable, Logger } from '@nestjs/common';
import { Esms, EsmsError } from 'esms-sms';
import { randomUUID } from 'crypto';
import {
  ISmsProvider,
  SendSmsOptions,
  SmsSendResult,
  SmsDeliveryStatus,
} from './sms-provider.interface';

export interface EsmsAfricaConfig {
  apiKey?: string;
  baseUrl?: string;
  senderId?: string;
  client?: Esms;
}

export function formatRwandaPhoneNumber(phone: string): {
  formatted: string;
  isValid: boolean;
} {
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  
  if (/^07[2389]\d{7}$/.test(cleaned)) {
    return { formatted: `+250${cleaned.slice(1)}`, isValid: true };
  }
  
  if (/^2507[2389]\d{7}$/.test(cleaned)) {
    return { formatted: `+${cleaned}`, isValid: true };
  }

  if (/^\+2507[2389]\d{7}$/.test(cleaned)) {
    return { formatted: cleaned, isValid: true };
  }

  // Fallback for general international numbers
  if (/^\+?\d{8,15}$/.test(cleaned)) {
    return { formatted: cleaned.startsWith('+') ? cleaned : `+${cleaned}`, isValid: true };
  }

  return { formatted: phone, isValid: false };
}

export function maskPhoneNumber(phone: string): string {
  if (!phone || phone.length < 7) return '***';
  const prefix = phone.slice(0, 5);
  const suffix = phone.slice(-3);
  return `${prefix}****${suffix}`;
}

export function mapEsmsStatusToInternal(status?: string): SmsDeliveryStatus {
  if (!status) return 'UNKNOWN';
  const s = status.toLowerCase();
  if (s === 'queued') return 'QUEUED';
  if (s === 'submitted') return 'SUBMITTED';
  if (s === 'delivered') return 'DELIVERED';
  if (s === 'failed' || s === 'rejected' || s === 'undelivered') return 'FAILED';
  if (s === 'pending') return 'PENDING';
  return 'QUEUED';
}

@Injectable()
export class EsmsAfricaSmsProvider implements ISmsProvider {
  readonly name = 'esmsafrica';
  private readonly logger = new Logger(EsmsAfricaSmsProvider.name);

  private readonly apiKey: string;
  private readonly baseUrl?: string;
  private readonly senderId: string;
  private client?: Esms;

  constructor(config?: EsmsAfricaConfig) {
    this.apiKey =
      config?.apiKey ??
      process.env.ESMS_API_KEY ??
      process.env.SMS_API_KEY ??
      '';
    this.baseUrl = config?.baseUrl ?? process.env.ESMS_BASE_URL;
    this.senderId =
      config?.senderId ??
      process.env.ESMS_SENDER_ID ??
      'eSMSAfrica';

    if (config?.client) {
      this.client = config.client;
    } else if (this.isConfigured()) {
      this.initClient();
    }
  }

  private initClient(): void {
    try {
      this.client = new Esms({
        apiKey: this.apiKey,
        ...(this.baseUrl ? { baseUrl: this.baseUrl } : {}),
      });
    } catch (err: any) {
      this.logger.error(`Failed to initialize eSMS client: ${err?.message}`);
    }
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  async send(options: SendSmsOptions): Promise<SmsSendResult> {
    const internalMessageId = `esms_int_${randomUUID()}`;

    if (!this.isConfigured()) {
      this.logger.warn('eSMS Africa provider active but API key is missing');
      return {
        internalMessageId,
        status: 'FAILED',
        error: 'eSMS Africa API key is missing or empty in environment configuration',
      };
    }

    const { formatted, isValid } = formatRwandaPhoneNumber(options.toNumber);
    if (!isValid) {
      this.logger.warn(
        `[${internalMessageId}] Invalid recipient phone number format: ${maskPhoneNumber(options.toNumber)}`,
      );
      return {
        internalMessageId,
        status: 'FAILED',
        error: `Invalid Rwanda/E.164 phone number format: ${options.toNumber}`,
      };
    }

    if (!this.client) {
      this.initClient();
    }

    try {
      this.logger.debug(
        `[${internalMessageId}] Submitting SMS via eSMS Africa to ${maskPhoneNumber(formatted)} (SenderID: ${this.senderId})`,
      );

      const res = await this.client!.messages.send({
        to: formatted,
        text: options.message,
        senderId: this.senderId,
      });

      const providerMessageId = res.id;
      const internalStatus = mapEsmsStatusToInternal(res.status);

      this.logger.log(
        `[${internalMessageId}] eSMS Africa response received: ProviderID: ${providerMessageId || 'N/A'}, ProviderStatus: ${res.status} -> InternalStatus: ${internalStatus}`,
      );

      return {
        internalMessageId,
        providerMessageId: providerMessageId || undefined,
        status: internalStatus,
        rawResponse: res,
      };
    } catch (err: unknown) {
      if (err instanceof EsmsError) {
        this.logger.error(
          `[${internalMessageId}] eSMS Africa SDK Error (${err.status} ${err.code}): ${err.message}`,
        );
        return {
          internalMessageId,
          status: 'FAILED',
          error: `eSMS SDK Error [${err.code}]: ${err.message}`,
          rawResponse: { status: err.status, code: err.code, message: err.message },
        };
      }

      const error = err as Error;
      this.logger.error(`[${internalMessageId}] eSMS Africa network/delivery error: ${error?.message || 'Unknown error'}`);
      return {
        internalMessageId,
        status: 'FAILED',
        error: error?.message || 'Unknown network error during SMS dispatch',
      };
    }
  }

  async getDeliveryStatus(providerMessageId: string): Promise<SmsSendResult> {
    const internalMessageId = `esms_chk_${randomUUID()}`;

    if (!providerMessageId) {
      return {
        internalMessageId,
        status: 'FAILED',
        error: 'Cannot query delivery status without a valid providerMessageId',
      };
    }

    if (!this.client) {
      this.initClient();
    }

    try {
      this.logger.debug(`[${internalMessageId}] Querying eSMS message status for ProviderID: ${providerMessageId}`);
      const res = await this.client!.messages.get(providerMessageId);
      const internalStatus = mapEsmsStatusToInternal(res.status);

      return {
        internalMessageId,
        providerMessageId: res.id || providerMessageId,
        status: internalStatus,
        rawResponse: res,
      };
    } catch (err: unknown) {
      if (err instanceof EsmsError) {
        this.logger.error(
          `[${internalMessageId}] Failed to fetch status for ${providerMessageId} (${err.code}): ${err.message}`,
        );
        return {
          internalMessageId,
          providerMessageId,
          status: 'UNKNOWN',
          error: `eSMS SDK Status Error [${err.code}]: ${err.message}`,
        };
      }

      const error = err as Error;
      return {
        internalMessageId,
        providerMessageId,
        status: 'UNKNOWN',
        error: error?.message || 'Failed to query message status from eSMS Africa',
      };
    }
  }
}


