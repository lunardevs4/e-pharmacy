import { ReminderWebhooksController } from './reminder-webhooks.controller';

describe('ReminderWebhooksController', () => {
  let controller: ReminderWebhooksController;
  let mockRemindersService: any;

  beforeEach(() => {
    mockRemindersService = {
      handleDeliveryStatusWebhook: jest.fn(),
      handleInboundSmsWebhook: jest.fn(),
    };

    controller = new ReminderWebhooksController(mockRemindersService);
  });

  it('should delegate delivery status callback to RemindersService', async () => {
    mockRemindersService.handleDeliveryStatusWebhook.mockResolvedValue({
      success: true,
      updated: true,
    });

    const payload = { id: 'ATXid_123', status: 'Delivered' };
    const result = await controller.handleDeliveryStatus(payload);

    expect(result).toEqual({ success: true, updated: true });
    expect(
      mockRemindersService.handleDeliveryStatusWebhook,
    ).toHaveBeenCalledWith(payload);
  });

  it('should delegate inbound SMS callback to RemindersService', async () => {
    mockRemindersService.handleInboundSmsWebhook.mockResolvedValue({
      success: true,
      confirmed: true,
    });

    const payload = { from: '+250788123456', text: 'YES' };
    const result = await controller.handleInboundSms(payload);

    expect(result).toEqual({ success: true, confirmed: true });
    expect(mockRemindersService.handleInboundSmsWebhook).toHaveBeenCalledWith(
      payload,
    );
  });
});
