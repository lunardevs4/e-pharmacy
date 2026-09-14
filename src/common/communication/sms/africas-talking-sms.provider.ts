import { Injectable, Logger } from '@nestjs/common';
import {
  ISmsProvider,
  SendSmsOptions,
  SmsSendResult,
} from './sms-provider.interface';

export interface AfricasTalkingConfig {
  apiKey?: string;
  username?: string;
  senderId?: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

export interface AfricasTalkingRecipient {
  statusCode: number;
  number: string;
  status: string;
  cost: string;
  messageId: string;
}

export interface AfricasTalkingResponse {
  SMSMessageData: {
    Message: string;
    Recipients: AfricasTalkingRecipient[];
  };
}

@Injectable()
export class AfricasTalkingSmsProvider implements ISmsProvider {
  readonly name = 'africastalking';
  private readonly logger = new Logger(AfricasTalkingSmsProvider.name);

  private readonly apiKey: string;
  private readonly username: string;
  private readonly senderId?: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;

  constructor(config?: AfricasTalkingConfig) {
    this.apiKey =
      config?.apiKey ??
      process.env.AT_API_KEY ??
      process.env.SMS_API_KEY ??
      '';
    this.username =
      config?.username ??
      process.env.AT_USERNAME ??
      'sandbox';
    this.senderId =
      config?.senderId ??
      process.env.AT_SENDER_ID ??
      process.env.SMS_FROM_NUMBER ??
      undefined;
    this.timeoutMs = config?.timeoutMs ?? 5000;
    this.fetchFn = config?.fetchFn ?? globalThis.fetch;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  private getBaseUrl(): string {
    return this.username.toLowerCase() === 'sandbox'
      ? 'https://api.sandbox.africastalking.com/version1/messaging'
      : 'https://api.africastalking.com/version1/messaging';
  }

  async send(options: SendSmsOptions): Promise<SmsSendResult> {
    if (!this.isConfigured()) {
      this.logger.warn(
        'Africa’s Talking SMS provider is active but API key is not configured',
      );
      return {
        providerMessageId: `at-unconfigured-${Date.now()}`,
        status: 'FAILED',
        error: 'Africa’s Talking API key is missing or empty',
      };
    }

    const endpoint = this.getBaseUrl();
    const params = new URLSearchParams();
    params.append('username', this.username);
    params.append('to', options.toNumber);
    params.append('message', options.message);
    if (this.senderId && this.senderId.trim()) {
      params.append('from', this.senderId.trim());
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      this.logger.debug(
        `Sending SMS via Africa's Talking to ${options.toNumber} using endpoint ${endpoint}`,
      );
      const response = await this.fetchFn(endpoint, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
          apiKey: this.apiKey,
        },
        body: params.toString(),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        this.logger.error(
          `Africa's Talking HTTP ${response.status}: ${errorText}`,
        );
        return {
          providerMessageId: `at-err-${Date.now()}`,
          status: 'FAILED',
          error: `HTTP ${response.status}: ${errorText || response.statusText}`,
        };
      }

      const data = (await response.json()) as AfricasTalkingResponse;
      const recipients = data?.SMSMessageData?.Recipients ?? [];

      if (!recipients.length) {
        const reason =
          data?.SMSMessageData?.Message || 'No recipients returned in response';
        this.logger.warn(`Africa's Talking send rejected: ${reason}`);
        return {
          providerMessageId: `at-rejected-${Date.now()}`,
          status: 'FAILED',
          error: reason,
          rawResponse: data,
        };
      }

      const primary = recipients[0];
      // AT Status codes: 100 = Processed, 101 = Sent, 102 = Queued
      const isSuccess =
        primary.statusCode === 101 ||
        primary.statusCode === 100 ||
        primary.statusCode === 102 ||
        primary.status?.toLowerCase() === 'success';

      return {
        providerMessageId: primary.messageId || `at-msg-${Date.now()}`,
        status: isSuccess ? 'SENT' : 'FAILED',
        error: isSuccess ? undefined : `Recipient status: ${primary.status}`,
        rawResponse: data,
      };
    } catch (err: unknown) {
      clearTimeout(timer);
      const error = err as Error;
      const isTimeout =
        error.name === 'AbortError' || error.message.includes('aborted');
      const errorMessage = isTimeout
        ? `Africa's Talking request timed out after ${this.timeoutMs}ms`
        : error.message || 'Unknown network error';

      this.logger.error(`Africa's Talking delivery error: ${errorMessage}`);
      return {
        providerMessageId: `at-fail-${Date.now()}`,
        status: 'FAILED',
        error: errorMessage,
      };
    }
  }
}
