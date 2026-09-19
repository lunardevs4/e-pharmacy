import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { CommunicationService } from './communication.service';
import { maskPhoneNumber, mapEsmsStatusToInternal } from './sms/esms-africa-sms.provider';

export interface SmsWebhookPayload {
  messageId?: string;
  id?: string;
  status?: string;
  recipient?: string;
  to?: string;
  errorCode?: string;
  errorMessage?: string;
  timestamp?: string;
}

@Controller('api/v1/communication/sms')
export class CommunicationController {
  private readonly logger = new Logger(CommunicationController.name);

  constructor(private readonly communicationService: CommunicationService) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleSmsWebhook(
    @Body() payload: SmsWebhookPayload,
    @Headers('x-esms-webhook-secret') secretHeader?: string,
    @Headers('authorization') authHeader?: string,
  ) {
    const expectedSecret = process.env.ESMS_WEBHOOK_SECRET;

    // Validate webhook secret if configured
    if (expectedSecret && expectedSecret.trim().length > 0) {
      const providedSecret =
        secretHeader ||
        (authHeader ? authHeader.replace(/^Bearer\s+/i, '') : undefined);

      if (providedSecret !== expectedSecret) {
        this.logger.warn(
          `Unauthorized webhook attempt received with invalid secret header`,
        );
        throw new UnauthorizedException('Invalid or missing webhook signature');
      }
    }

    const providerMessageId = payload.id || payload.messageId;
    if (!providerMessageId) {
      this.logger.warn(`Malformed webhook payload received without message ID`);
      throw new BadRequestException('Webhook payload missing provider message identifier');
    }

    const recipient = payload.recipient || payload.to || 'unknown';
    const rawStatus = payload.status || 'UNKNOWN';
    const internalStatus = mapEsmsStatusToInternal(rawStatus);

    this.logger.log(
      `[SMS Webhook] Received delivery update for ProviderID: ${providerMessageId} | Recipient: ${maskPhoneNumber(recipient)} | ProviderStatus: ${rawStatus} -> MappedStatus: ${internalStatus}`,
    );

    return {
      success: true,
      providerMessageId,
      status: internalStatus,
      processedAt: new Date().toISOString(),
    };
  }
}
