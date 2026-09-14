import { AfricasTalkingSmsProvider } from './africas-talking-sms.provider';

describe('AfricasTalkingSmsProvider', () => {
  const successFixture = {
    SMSMessageData: {
      Message: 'Sent to 1/1 Total Cost: RWF 10.0000',
      Recipients: [
        {
          statusCode: 101,
          number: '+250788123456',
          status: 'Success',
          cost: 'RWF 10.0000',
          messageId: 'ATXid_c8a7f654b3e2d1',
        },
      ],
    },
  };

  const emptyRecipientsFixture = {
    SMSMessageData: {
      Message: 'Invalid phone number provided',
      Recipients: [],
    },
  };

  const failedRecipientFixture = {
    SMSMessageData: {
      Message: 'Sent to 0/1 Total Cost: RWF 0.0000',
      Recipients: [
        {
          statusCode: 403,
          number: '+250788123456',
          status: 'UserInBlackList',
          cost: '0',
          messageId: 'None',
        },
      ],
    },
  };

  it('should return FAILED when API key is missing', async () => {
    const provider = new AfricasTalkingSmsProvider({
      apiKey: '',
      username: 'sandbox',
    });

    const result = await provider.send({
      toNumber: '+250788123456',
      message: 'Test message',
    });

    expect(result.status).toBe('FAILED');
    expect(result.error).toContain('API key is missing');
  });

  it('should successfully parse Africa’s Talking success response fixture', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(successFixture),
    } as unknown as Response);

    const provider = new AfricasTalkingSmsProvider({
      apiKey: 'at_test_key_123',
      username: 'sandbox',
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    const result = await provider.send({
      toNumber: '+250788123456',
      message: 'Time to take your medication',
    });

    expect(result.status).toBe('SENT');
    expect(result.providerMessageId).toBe('ATXid_c8a7f654b3e2d1');
    expect(result.error).toBeUndefined();
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.sandbox.africastalking.com/version1/messaging',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          apiKey: 'at_test_key_123',
          'Content-Type': 'application/x-www-form-urlencoded',
        }),
      }),
    );
  });

  it('should handle rejected recipient status from Africa’s Talking', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(failedRecipientFixture),
    } as unknown as Response);

    const provider = new AfricasTalkingSmsProvider({
      apiKey: 'at_test_key_123',
      username: 'sandbox',
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    const result = await provider.send({
      toNumber: '+250788123456',
      message: 'Test message',
    });

    expect(result.status).toBe('FAILED');
    expect(result.error).toContain('UserInBlackList');
  });

  it('should handle empty recipients array from Africa’s Talking', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(emptyRecipientsFixture),
    } as unknown as Response);

    const provider = new AfricasTalkingSmsProvider({
      apiKey: 'at_test_key_123',
      username: 'sandbox',
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    const result = await provider.send({
      toNumber: '+250788123456',
      message: 'Test message',
    });

    expect(result.status).toBe('FAILED');
    expect(result.error).toContain('Invalid phone number');
  });

  it('should handle HTTP error responses from Africa’s Talking gateway', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: jest.fn().mockResolvedValue('The supplied authentication is invalid'),
    } as unknown as Response);

    const provider = new AfricasTalkingSmsProvider({
      apiKey: 'invalid_key',
      username: 'sandbox',
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    const result = await provider.send({
      toNumber: '+250788123456',
      message: 'Test message',
    });

    expect(result.status).toBe('FAILED');
    expect(result.error).toContain('HTTP 401');
  });

  it('should handle timeout abort gracefully', async () => {
    const mockFetch = jest.fn().mockImplementation(() => {
      const error = new Error('The operation was aborted');
      error.name = 'AbortError';
      return Promise.reject(error);
    });

    const provider = new AfricasTalkingSmsProvider({
      apiKey: 'test_key',
      username: 'sandbox',
      timeoutMs: 100,
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    const result = await provider.send({
      toNumber: '+250788123456',
      message: 'Test message',
    });

    expect(result.status).toBe('FAILED');
    expect(result.error).toContain('timed out');
  });
});
