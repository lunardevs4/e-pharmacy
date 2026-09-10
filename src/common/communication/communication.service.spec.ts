import { CommunicationService } from './communication.service';

describe('CommunicationService', () => {
    it('should return a successful mock SMS result in mock mode', async () => {
        const originalSms = process.env.SMS_PROVIDER_MODE;
        const originalKey = process.env.SMS_API_KEY;
        process.env.SMS_PROVIDER_MODE = 'mock';
        process.env.SMS_API_KEY = 'test-key';
        process.env.SMS_API_SECRET = 'test-secret';

        const service = new CommunicationService();
        const result = await service.sendSms('+250788123456', 'Take your medicine');

        expect(result.status).toBe('SENT');
        expect(result.channel).toBe('SMS');
        expect(result.provider).toBe('mock');

        if (originalSms === undefined) delete process.env.SMS_PROVIDER_MODE;
        else process.env.SMS_PROVIDER_MODE = originalSms;
        if (originalKey === undefined) delete process.env.SMS_API_KEY;
        else process.env.SMS_API_KEY = originalKey;
    });
});
