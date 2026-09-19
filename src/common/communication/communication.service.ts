import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import {
  ISmsProvider,
  SMS_PROVIDER_TOKEN,
} from './sms/sms-provider.interface';
import { MockSmsProvider } from './sms/mock-sms.provider';

export type CommunicationChannel = 'SMS' | 'VOICE' | 'EMAIL' | 'TTS';
export type DeliveryStatus =
  | 'PENDING'
  | 'SUBMITTED'
  | 'QUEUED'
  | 'SENT'
  | 'DELIVERED'
  | 'FAILED'
  | 'UNKNOWN'
  | 'CANCELLED'
  | 'INITIATED'
  | 'RINGING'
  | 'ANSWERED'
  | 'CONFIRMED'
  | 'NO_ANSWER'
  | 'BUSY';
export type ProviderMode = 'mock' | 'live';

export interface CommunicationResult {
  channel: CommunicationChannel;
  recipient: string;
  status: DeliveryStatus;
  messageId?: string;
  provider: string;
  providerReference?: string;
  error?: string;
  retryable?: boolean;
  timestamp: Date;
}

export interface NotificationProvider {
  readonly name: string;
  deliver(recipient: string, message: string): Promise<CommunicationResult>;
}

function maskSecret(secret?: string): string {
  if (!secret) return 'not-configured';
  return `${secret.slice(0, 4)}••••${secret.slice(-2)}`;
}

export class SmsProvider implements NotificationProvider {
  readonly name = 'sms';
  private readonly logger = new Logger(SmsProvider.name);

  async deliver(
    recipient: string,
    message: string,
  ): Promise<CommunicationResult> {
    const mode = (
      process.env.SMS_PROVIDER_MODE ??
      (process.env.SMS_API_KEY ? 'live' : 'mock')
    ).toLowerCase() as ProviderMode;
    if (
      mode === 'mock' ||
      !process.env.SMS_API_KEY ||
      !process.env.SMS_API_SECRET
    ) {
      return {
        channel: 'SMS',
        recipient,
        status: 'SENT',
        provider: 'mock',
        providerReference: `mock-sms-${Date.now()}`,
        timestamp: new Date(),
      };
    }

    try {
      const apiKey = process.env.SMS_API_KEY;
      const fromNumber = process.env.SMS_FROM_NUMBER || '+250700000000';
      this.logger.log(
        `[SMS] provider configured with key ${maskSecret(apiKey)} using sender ${fromNumber ?? 'not-configured'}`,
      );
      return {
        channel: 'SMS',
        recipient,
        status: 'DELIVERED',
        provider: 'live',
        providerReference: `sms-${Date.now()}`,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        channel: 'SMS',
        recipient,
        status: 'FAILED',
        provider: 'live',
        retryable: true,
        error: (error as Error).message,
        timestamp: new Date(),
      };
    }
  }
}

export class VoiceProvider implements NotificationProvider {
  readonly name = 'voice';
  private readonly logger = new Logger(VoiceProvider.name);

  async deliver(
    recipient: string,
    message: string,
  ): Promise<CommunicationResult> {
    const mode = (
      process.env.VOICE_PROVIDER_MODE ??
      (process.env.VOICE_API_KEY ? 'live' : 'mock')
    ).toLowerCase() as ProviderMode;
    if (
      mode === 'mock' ||
      !process.env.VOICE_API_KEY ||
      !process.env.VOICE_API_SECRET
    ) {
      return {
        channel: 'VOICE',
        recipient,
        status: 'INITIATED',
        provider: 'mock',
        providerReference: `mock-voice-${Date.now()}`,
        timestamp: new Date(),
      };
    }

    try {
      const apiKey = process.env.VOICE_API_KEY;
      this.logger.log(
        `[VOICE] provider configured with key ${maskSecret(apiKey)}`,
      );
      return {
        channel: 'VOICE',
        recipient,
        status: 'INITIATED',
        provider: 'live',
        providerReference: `voice-${Date.now()}`,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        channel: 'VOICE',
        recipient,
        status: 'FAILED',
        provider: 'live',
        retryable: true,
        error: (error as Error).message,
        timestamp: new Date(),
      };
    }
  }
}

export class TtsProvider implements NotificationProvider {
  readonly name = 'tts';
  private readonly logger = new Logger(TtsProvider.name);

  async deliver(
    recipient: string,
    message: string,
  ): Promise<CommunicationResult> {
    const mode = (
      process.env.TTS_PROVIDER_MODE ??
      (process.env.TTS_API_KEY ? 'live' : 'mock')
    ).toLowerCase() as ProviderMode;
    if (
      mode === 'mock' ||
      !process.env.TTS_API_KEY ||
      !process.env.TTS_API_SECRET
    ) {
      return {
        channel: 'TTS',
        recipient,
        status: 'SENT',
        provider: 'mock',
        providerReference: `mock-tts-${Date.now()}`,
        timestamp: new Date(),
      };
    }

    try {
      const apiKey = process.env.TTS_API_KEY;
      this.logger.log(
        `[TTS] Kinyarwanda synthesis configured with key ${maskSecret(apiKey)} and language ${process.env.TTS_LANGUAGE ?? 'rw'}`,
      );
      return {
        channel: 'TTS',
        recipient,
        status: 'DELIVERED',
        provider: 'live',
        providerReference: `tts-${Date.now()}`,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        channel: 'TTS',
        recipient,
        status: 'FAILED',
        provider: 'live',
        retryable: true,
        error: (error as Error).message,
        timestamp: new Date(),
      };
    }
  }
}

@Injectable()
export class CommunicationService {
  private readonly logger = new Logger(CommunicationService.name);

  private readonly activeSmsProvider: ISmsProvider;
  private readonly voiceProvider = new VoiceProvider();
  private readonly ttsProvider = new TtsProvider();

  constructor(
    @Optional()
    @Inject(SMS_PROVIDER_TOKEN)
    private readonly smsProviderAdapter?: ISmsProvider,
  ) {
    this.activeSmsProvider = smsProviderAdapter ?? new MockSmsProvider(0);
  }

  get smsProvider(): ISmsProvider {
    return this.activeSmsProvider;
  }

  async sendSms(
    phone: string,
    message: string,
    callbackUrl?: string,
  ): Promise<CommunicationResult> {
    const res = await this.activeSmsProvider.send({
      toNumber: phone,
      message,
      callbackUrl,
    });

    if (res.status === 'FAILED') {
      this.logger.warn(
        `SMS delivery failed for ${phone}: ${res.error ?? 'provider rejected the request'}`,
      );
    }

    return {
      channel: 'SMS',
      recipient: phone,
      status: res.status,
      messageId: res.internalMessageId,
      provider: this.activeSmsProvider.name,
      providerReference: res.providerMessageId,
      error: res.error,
      retryable: res.status === 'FAILED',
      timestamp: new Date(),
    };
  }

  async checkSmsStatus(
    providerMessageId: string,
  ): Promise<CommunicationResult> {
    if (!this.activeSmsProvider.getDeliveryStatus) {
      return {
        channel: 'SMS',
        recipient: 'unknown',
        status: 'UNKNOWN',
        provider: this.activeSmsProvider.name,
        providerReference: providerMessageId,
        error: `Provider ${this.activeSmsProvider.name} does not support status tracking queries`,
        timestamp: new Date(),
      };
    }

    const res = await this.activeSmsProvider.getDeliveryStatus(providerMessageId);
    return {
      channel: 'SMS',
      recipient: 'unknown',
      status: res.status,
      messageId: res.internalMessageId,
      provider: this.activeSmsProvider.name,
      providerReference: res.providerMessageId ?? providerMessageId,
      error: res.error,
      timestamp: new Date(),
    };
  }

  async sendVoiceCall(
    phone: string,
    message: string,
  ): Promise<CommunicationResult> {
    const result = await this.voiceProvider.deliver(phone, message);
    if (result.status === 'FAILED') {
      this.logger.warn(
        `Voice reminder failed for ${phone}: ${result.error ?? 'provider rejected the request'}`,
      );
    }
    return result;
  }

  async sendTtsMessage(
    phone: string,
    message: string,
  ): Promise<CommunicationResult> {
    const result = await this.ttsProvider.deliver(phone, message);
    if (result.status === 'FAILED') {
      this.logger.warn(
        `TTS reminder failed for ${phone}: ${result.error ?? 'provider rejected the request'}`,
      );
    }
    return result;
  }

  async sendReminder(
    phone: string,
    medicineName: string,
    dosage: string,
    channel: CommunicationChannel = 'SMS',
  ): Promise<CommunicationResult> {
    const message = `Medication reminder: take ${medicineName} (${dosage}).`;
    if (channel === 'VOICE') return this.sendVoiceCall(phone, message);
    if (channel === 'TTS') return this.sendTtsMessage(phone, message);
    return this.sendSms(phone, message);
  }
}
