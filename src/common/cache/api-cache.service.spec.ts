import { ApiCacheService } from './api-cache.service';

describe('ApiCacheService', () => {
  it('coalesces concurrent requests and reuses the cached value', async () => {
    const cache = new ApiCacheService();
    const factory = jest.fn().mockResolvedValue({ value: 42 });

    const [first, second] = await Promise.all([
      cache.getOrSet('hot-endpoint', factory, 10_000),
      cache.getOrSet('hot-endpoint', factory, 10_000),
    ]);

    expect(first).toEqual({ value: 42 });
    expect(second).toEqual({ value: 42 });
    expect(factory).toHaveBeenCalledTimes(1);

    await cache.getOrSet('hot-endpoint', factory, 10_000);
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('invalidates entries by prefix', async () => {
    const cache = new ApiCacheService();
    const firstFactory = jest.fn().mockResolvedValue('first');
    const secondFactory = jest.fn().mockResolvedValue('second');

    await cache.getOrSet('search:one', firstFactory, 10_000);
    await cache.getOrSet('medicine:one', secondFactory, 10_000);
    cache.invalidate('search:');
    await cache.getOrSet('search:one', firstFactory, 10_000);
    await cache.getOrSet('medicine:one', secondFactory, 10_000);

    expect(firstFactory).toHaveBeenCalledTimes(2);
    expect(secondFactory).toHaveBeenCalledTimes(1);
  });
});
