import { CommunicationController } from './communication.controller';
import { CommunicationService } from './communication.service';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';

describe('CommunicationController (SMS Webhook)', () => {
  let controller: CommunicationController;
  let mockCommsService: Partial<CommunicationService>;

  beforeEach(() => {
    delete process.env.ESMS_WEBHOOK_SECRET;
    mockCommsService = {};
    controller = new CommunicationController(mockCommsService as CommunicationService);
  });

  it('should accept valid webhook callback and map status correctly', async () => {
    const result = await controller.handleSmsWebhook({
      id: 'test_msg_99999',
      status: 'delivered',
      recipient: '+250788123456',
    });

    expect(result.success).toBe(true);
    expect(result.providerMessageId).toBe('test_msg_99999');
    expect(result.status).toBe('DELIVERED');
  });

  it('should reject webhook payloads missing provider message ID', async () => {
    await expect(
      controller.handleSmsWebhook({
        status: 'delivered',
        recipient: '+250788123456',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should enforce webhook secret validation when ESMS_WEBHOOK_SECRET is set', async () => {
    process.env.ESMS_WEBHOOK_SECRET = 'super_secret_webhook_token';

    // Invalid secret header
    await expect(
      controller.handleSmsWebhook(
        { id: 'msg_123', status: 'delivered' },
        'wrong_secret',
      ),
    ).rejects.toThrow(UnauthorizedException);

    // Valid secret header
    const validResult = await controller.handleSmsWebhook(
      { id: 'msg_123', status: 'delivered' },
      'super_secret_webhook_token',
    );
    expect(validResult.success).toBe(true);
  });
});
