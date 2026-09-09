import { Injectable } from '@nestjs/common';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

@Injectable()
export class ApiCacheService {
  private readonly entries = new Map<string, CacheEntry<unknown>>();
  private readonly inFlight = new Map<string, Promise<unknown>>();
  private readonly maxEntries = 500;

  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttlMs: number,
  ): Promise<T> {
    const cached = this.entries.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.value as T;
    this.entries.delete(key);

    const pending = this.inFlight.get(key);
    if (pending) return pending as Promise<T>;

    const request = factory()
      .then((value) => {
        if (this.entries.size >= this.maxEntries) {
          const oldestKey = this.entries.keys().next().value;
          if (oldestKey) this.entries.delete(oldestKey);
        }
        this.entries.set(key, { value, expiresAt: Date.now() + ttlMs });
        return value;
      })
      .finally(() => this.inFlight.delete(key));

    this.inFlight.set(key, request);
    return request;
  }

  invalidate(prefix?: string) {
    if (!prefix) {
      this.entries.clear();
      return;
    }
    for (const key of this.entries.keys()) {
      if (key.startsWith(prefix)) this.entries.delete(key);
    }
  }
}
