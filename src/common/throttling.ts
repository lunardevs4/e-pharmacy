import { ConfigService } from '@nestjs/config';
import { ThrottlerGetTrackerFunction } from '@nestjs/throttler';

export const getNumberConfig = (
  config: ConfigService,
  name: string,
  fallback: number,
) => {
  const value = Number(config.get<string>(name));
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

export const userTracker: ThrottlerGetTrackerFunction = (request) =>
  request.user?.id ? `user:${request.user.id}` : `ip:${request.ip}`;
