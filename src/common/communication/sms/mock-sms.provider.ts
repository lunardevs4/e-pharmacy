import { Injectable, Logger } from '@nestjs/common';
import {
  ISmsProvider,
  SendSmsOptions,
  SmsSendResult,
} from './sms-provider.interface';

@Injectable()
export class MockSmsProvider implements ISmsProvider {
  readonly name = 'mock';
  private readonly logger = new Logger(MockSmsProvider.name);

  constructor(private readonly simulatedLatencyMs: number = 30) {}

  async send(options: SendSmsOptions): Promise<SmsSendResult> {
    if (this.simulatedLatencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.simulatedLatencyMs));
    }

    const internalMessageId = `int-mock-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    // Allow simulating failure in tests via specific phone number or flag
    if (
      options.toNumber.includes('000000000') ||
      options.message.includes('[SIMULATE_FAIL]')
    ) {
      this.logger.warn(
        `[MockSmsProvider] Simulating delivery failure for recipient ${options.toNumber}`,
      );
      return {
        internalMessageId,
        providerMessageId: `mock-fail-${Date.now()}`,
        status: 'FAILED',
        error: 'Simulated carrier delivery failure',
      };
    }

    const providerMessageId = `mock-msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    this.logger.log(
      `[MockSmsProvider] Sent SMS to ${options.toNumber} (ID: ${providerMessageId}): "${options.message}"`,
    );

    return {
      internalMessageId,
      providerMessageId,
      status: 'SENT',
      rawResponse: {
        to: options.toNumber,
        callbackUrl: options.callbackUrl,
        timestamp: new Date().toISOString(),
      },
    };
  }

  async getDeliveryStatus(providerMessageId: string): Promise<SmsSendResult> {
    const internalMessageId = `int-status-${Date.now()}`;
    if (providerMessageId.includes('fail')) {
      return {
        internalMessageId,
        providerMessageId,
        status: 'FAILED',
        error: 'Simulated failure status',
      };
    }

    return {
      internalMessageId,
      providerMessageId,
      status: 'DELIVERED',
      rawResponse: { providerMessageId, status: 'DELIVERED' },
    };
  }
}
