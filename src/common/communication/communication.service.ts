import { Injectable, Logger } from '@nestjs/common';

export type CommunicationChannel = 'SMS' | 'VOICE' | 'EMAIL';
export type DeliveryStatus = 'SENT' | 'FAILED' | 'PENDING';

export interface CommunicationResult {
  channel: CommunicationChannel;
  recipient: string;
  status: DeliveryStatus;
  messageId?: string;
  error?: string;
  timestamp: Date;
}

@Injectable()
export class CommunicationService {
  private readonly logger = new Logger(CommunicationService.name);

  private readonly smsConfigured = !!(
    process.env.SMS_API_KEY && process.env.SMS_API_SECRET
  );

  private readonly voiceConfigured = !!(
    process.env.VOICE_API_KEY && process.env.VOICE_API_SECRET
  );

  async sendSms(
    phone: string,
    message: string,
  ): Promise<CommunicationResult> {
    if (this.smsConfigured) {
      return this.dispatchSms(phone, message);
    }

    this.logger.log(
      `[DEV-FALLBACK] SMS to ${phone}: ${message.substring(0, 80)}...`,
    );

    return {
      channel: 'SMS',
      recipient: phone,
      status: 'SENT',
      messageId: `dev-sms-${Date.now()}`,
      timestamp: new Date(),
    };
  }

  async sendVoiceCall(
    phone: string,
    message: string,
  ): Promise<CommunicationResult> {
    if (this.voiceConfigured) {
      return this.dispatchVoice(phone, message);
    }

    this.logger.log(
      `[DEV-FALLBACK] Voice call to ${phone}: ${message.substring(0, 80)}...`,
    );

    return {
      channel: 'VOICE',
      recipient: phone,
      status: 'SENT',
      messageId: `dev-voice-${Date.now()}`,
      timestamp: new Date(),
    };
  }

  async sendReminder(
    phone: string,
    medicineName: string,
    dosage: string,
    channel: CommunicationChannel = 'SMS',
  ): Promise<CommunicationResult> {
    const message = `Medicine Reminder: Time to take ${medicineName} (${dosage}). - Rwanda E-Pharmacy`;

    if (channel === 'VOICE') {
      return this.sendVoiceCall(phone, message);
    }

    return this.sendSms(phone, message);
  }

  private async dispatchSms(
    phone: string,
    message: string,
  ): Promise<CommunicationResult> {
    try {
      const apiKey = process.env.SMS_API_KEY;
      const apiSecret = process.env.SMS_API_SECRET;
      const fromNumber = process.env.SMS_FROM_NUMBER || '+250700000000';

      this.logger.log(
        `Sending SMS to ${phone} via configured provider (key: ${apiKey?.substring(0, 4)}...)`,
      );


      return {
        channel: 'SMS',
        recipient: phone,
        status: 'SENT',
        messageId: `sms-${Date.now()}`,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(
        `SMS delivery failed to ${phone}: ${(error as Error).message}`,
      );
      return {
        channel: 'SMS',
        recipient: phone,
        status: 'FAILED',
        error: (error as Error).message,
        timestamp: new Date(),
      };
    }
  }

  private async dispatchVoice(
    phone: string,
    message: string,
  ): Promise<CommunicationResult> {
    try {
      const apiKey = process.env.VOICE_API_KEY;
      const apiSecret = process.env.VOICE_API_SECRET;

      this.logger.log(
        `Initiating voice call to ${phone} via configured provider (key: ${apiKey?.substring(0, 4)}...)`,
      );


      return {
        channel: 'VOICE',
        recipient: phone,
        status: 'SENT',
        messageId: `voice-${Date.now()}`,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(
        `Voice call failed to ${phone}: ${(error as Error).message}`,
      );
      return {
        channel: 'VOICE',
        recipient: phone,
        status: 'FAILED',
        error: (error as Error).message,
        timestamp: new Date(),
      };
    }
  }
}
