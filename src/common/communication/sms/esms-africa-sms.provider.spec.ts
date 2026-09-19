import {
  EsmsAfricaSmsProvider,
  formatRwandaPhoneNumber,
  maskPhoneNumber,
  mapEsmsStatusToInternal,
} from './esms-africa-sms.provider';
import { Esms, EsmsError } from 'esms-sms';

describe('EsmsAfricaSmsProvider & Utilities', () => {
  describe('Helper Functions', () => {
    it('formatRwandaPhoneNumber should format local and international numbers correctly', () => {
      expect(formatRwandaPhoneNumber('0788123456')).toEqual({
        formatted: '+250788123456',
        isValid: true,
      });
      expect(formatRwandaPhoneNumber('250788123456')).toEqual({
        formatted: '+250788123456',
        isValid: true,
      });
      expect(formatRwandaPhoneNumber('+250788123456')).toEqual({
        formatted: '+250788123456',
        isValid: true,
      });
      expect(formatRwandaPhoneNumber('invalid-number')).toEqual({
        formatted: 'invalid-number',
        isValid: false,
      });
    });

    it('maskPhoneNumber should mask phone numbers for privacy', () => {
      expect(maskPhoneNumber('+250788123456')).toBe('+2507****456');
      expect(maskPhoneNumber('123')).toBe('***');
    });

    it('mapEsmsStatusToInternal should accurately map provider statuses', () => {
      expect(mapEsmsStatusToInternal('queued')).toBe('QUEUED');
      expect(mapEsmsStatusToInternal('submitted')).toBe('SUBMITTED');
      expect(mapEsmsStatusToInternal('delivered')).toBe('DELIVERED');
      expect(mapEsmsStatusToInternal('failed')).toBe('FAILED');
      expect(mapEsmsStatusToInternal('rejected')).toBe('FAILED');
      expect(mapEsmsStatusToInternal(undefined)).toBe('UNKNOWN');
    });
  });

  describe('EsmsAfricaSmsProvider Unit Tests', () => {
    let mockEsmsClient: any;
    let provider: EsmsAfricaSmsProvider;

    beforeEach(() => {
      mockEsmsClient = {
        messages: {
          send: jest.fn(),
          get: jest.fn(),
        },
      };

      provider = new EsmsAfricaSmsProvider({
        apiKey: 'esms_test_dummy_key',
        senderId: 'eSMSAfrica',
        client: mockEsmsClient as unknown as Esms,
      });
    });

    it('should submit valid SMS and map response to QUEUED without claiming DELIVERED', async () => {
      mockEsmsClient.messages.send.mockResolvedValue({
        id: 'test_msg_12345',
        status: 'queued',
        to: '+250788123456',
      });

      const result = await provider.send({
        toNumber: '+250788123456',
        message: 'Medication adherence reminder',
      });

      expect(result.status).toBe('QUEUED');
      expect(result.status).not.toBe('DELIVERED');
      expect(result.internalMessageId).toMatch(/^esms_int_/);
      expect(result.providerMessageId).toBe('test_msg_12345');
      expect(result.error).toBeUndefined();
      expect(mockEsmsClient.messages.send).toHaveBeenCalledWith({
        to: '+250788123456',
        text: 'Medication adherence reminder',
        senderId: 'eSMSAfrica',
      });
    });

    it('should reject invalid recipient phone numbers without calling SDK', async () => {
      const result = await provider.send({
        toNumber: 'invalid-phone-abc',
        message: 'Hello',
      });

      expect(result.status).toBe('FAILED');
      expect(result.error).toContain('Invalid Rwanda/E.164 phone number format');
      expect(mockEsmsClient.messages.send).not.toHaveBeenCalled();
    });

    it('should handle unconfigured provider gracefully', async () => {
      const unconfiguredProvider = new EsmsAfricaSmsProvider({
        apiKey: '',
      });

      const result = await unconfiguredProvider.send({
        toNumber: '+250788123456',
        message: 'Hello',
      });

      expect(result.status).toBe('FAILED');
      expect(result.error).toContain('missing or empty');
    });

    it('should catch EsmsError and return structured failure details', async () => {
      const esmsErr = new EsmsError('Invalid API Key');
      (esmsErr as any).status = 401;
      (esmsErr as any).code = 'AUTHENTICATION_ERROR';

      mockEsmsClient.messages.send.mockRejectedValue(esmsErr);

      const result = await provider.send({
        toNumber: '+250788123456',
        message: 'Hello',
      });

      expect(result.status).toBe('FAILED');
      expect(result.error).toContain('eSMS SDK Error [AUTHENTICATION_ERROR]');
    });

    it('should query message delivery status via getDeliveryStatus', async () => {
      mockEsmsClient.messages.get.mockResolvedValue({
        id: 'test_msg_12345',
        status: 'delivered',
      });

      const result = await provider.getDeliveryStatus('test_msg_12345');

      expect(result.status).toBe('DELIVERED');
      expect(result.providerMessageId).toBe('test_msg_12345');
      expect(mockEsmsClient.messages.get).toHaveBeenCalledWith('test_msg_12345');
    });
  });
});
