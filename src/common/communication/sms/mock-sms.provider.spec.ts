import { MockSmsProvider } from './mock-sms.provider';

describe('MockSmsProvider', () => {
  let provider: MockSmsProvider;

  beforeEach(() => {
    provider = new MockSmsProvider(0); // 0ms latency for fast tests
  });

  it('should successfully send mock SMS and return deterministic message ID', async () => {
    const result = await provider.send({
      toNumber: '+250788123456',
      message: 'Time to take your medication',
      callbackUrl: 'https://example.com/callback',
    });

    expect(result.status).toBe('SENT');
    expect(result.providerMessageId).toMatch(/^mock-msg-/);
    expect(result.error).toBeUndefined();
    expect(result.rawResponse).toBeDefined();
  });

  it('should simulate carrier delivery failure for failure-triggering recipients', async () => {
    const result = await provider.send({
      toNumber: '+250000000000',
      message: 'Time to take your medication',
    });

    expect(result.status).toBe('FAILED');
    expect(result.providerMessageId).toMatch(/^mock-fail-/);
    expect(result.error).toContain('Simulated carrier delivery failure');
  });

  it('should simulate carrier delivery failure when [SIMULATE_FAIL] tag is in message', async () => {
    const result = await provider.send({
      toNumber: '+250788123456',
      message: 'Take your medication [SIMULATE_FAIL]',
    });

    expect(result.status).toBe('FAILED');
    expect(result.error).toContain('Simulated carrier delivery failure');
  });
});
