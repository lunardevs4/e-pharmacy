import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '../common/guards/public.decorator';
import { RemindersService } from './reminders.service';
import {
  DeliveryStatusWebhookDto,
  InboundSmsWebhookDto,
} from './dto/reminders.dto';

@ApiTags('Reminder Webhooks')
@Controller('api/v1/reminders/webhooks')
export class ReminderWebhooksController {
  private readonly logger = new Logger(ReminderWebhooksController.name);

  constructor(private readonly remindersService: RemindersService) {}

  @Public()
  @Post('delivery-status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Receive SMS delivery status callback from provider',
    description:
      'Public webhook receiving status callbacks from Africa’s Talking or mock provider.',
  })
  @ApiResponse({ status: 200, description: 'Delivery status processed' })
  async handleDeliveryStatus(@Body() body: DeliveryStatusWebhookDto) {
    this.logger.log(
      `Received SMS delivery status webhook: ${JSON.stringify(body)}`,
    );
    return this.remindersService.handleDeliveryStatusWebhook(body);
  }

  @Public()
  @Post('inbound-sms')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Receive inbound SMS replies for patient medication confirmation',
    description:
      'Public webhook receiving inbound SMS replies ("YES", "TAKEN", "1", "EGO") to confirm dose.',
  })
  @ApiResponse({ status: 200, description: 'Inbound SMS processed' })
  async handleInboundSms(@Body() body: InboundSmsWebhookDto) {
    this.logger.log(`Received inbound SMS webhook: ${JSON.stringify(body)}`);
    return this.remindersService.handleInboundSmsWebhook(body);
  }
}
