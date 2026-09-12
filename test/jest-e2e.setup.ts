process.env.DATABASE_URL =
    process.env.DATABASE_URL ??
    'postgresql://user:pass@localhost:5432/epharmacy_test';
process.env.JWT_SECRET =
    process.env.JWT_SECRET ?? '12345678901234567890123456789012';
process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
// Keep endpoint tests deterministic and independent of a local Redis server.
process.env.REDIS_URL = '';
