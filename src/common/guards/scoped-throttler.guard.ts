import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  ThrottlerGuard,
  ThrottlerModuleOptions,
  ThrottlerOptions,
  ThrottlerStorage,
  ThrottlerRequest,
} from '@nestjs/throttler';
import {
  THROTTLER_BLOCK_DURATION,
  THROTTLER_KEY_GENERATOR,
  THROTTLER_LIMIT,
  THROTTLER_SKIP,
  THROTTLER_TRACKER,
  THROTTLER_TTL,
} from '@nestjs/throttler/dist/throttler.constants';

/**
 * Nest's default guard evaluates every named throttler on every route.
 * This guard keeps the baseline bucket global and activates named buckets
 * only on handlers/classes that explicitly use @Throttle({ name: {} }).
 */
@Injectable()
export class ScopedThrottlerGuard extends ThrottlerGuard {
  constructor(
    options: ThrottlerModuleOptions,
    storageService: ThrottlerStorage,
    reflector: Reflector,
  ) {
    super(options, storageService, reflector);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (await this.shouldSkip(context)) return true;

    const handler = context.getHandler();
    const classRef = context.getClass();
    const results: boolean[] = [];

    for (const throttler of this.throttlers) {
      const hasRouteOverride =
        throttler.name === 'default' ||
        Reflect.hasMetadata(THROTTLER_LIMIT + throttler.name, handler) ||
        Reflect.hasMetadata(THROTTLER_LIMIT + throttler.name, classRef);

      if (!hasRouteOverride) {
        results.push(true);
        continue;
      }

      const skip = this.reflector.getAllAndOverride<boolean>(
        THROTTLER_SKIP + throttler.name,
        [handler, classRef],
      );
      const skipIf = throttler.skipIf || this.commonOptions.skipIf;
      if (skip || (skipIf && (await skipIf(context)))) {
        results.push(true);
        continue;
      }

      const resolve = async <T>(value: T | ((ctx: ExecutionContext) => T | Promise<T>)) =>
        typeof value === 'function'
          ? await (value as (ctx: ExecutionContext) => T | Promise<T>)(context)
          : value;
      const routeLimit = this.reflector.getAllAndOverride<any>(THROTTLER_LIMIT + throttler.name, [handler, classRef]);
      const routeTtl = this.reflector.getAllAndOverride<any>(THROTTLER_TTL + throttler.name, [handler, classRef]);
      const routeBlockDuration = this.reflector.getAllAndOverride<any>(THROTTLER_BLOCK_DURATION + throttler.name, [handler, classRef]);
      const routeTracker = this.reflector.getAllAndOverride<any>(THROTTLER_TRACKER + throttler.name, [handler, classRef]);
      const routeKeyGenerator = this.reflector.getAllAndOverride<any>(THROTTLER_KEY_GENERATOR + throttler.name, [handler, classRef]);
      const getTracker = routeTracker || throttler.getTracker || this.commonOptions.getTracker;
      const generateKey = routeKeyGenerator || throttler.generateKey || this.commonOptions.generateKey;

      results.push(await this.handleRequest({
        context,
        limit: await resolve(routeLimit ?? throttler.limit),
        ttl: await resolve(routeTtl ?? throttler.ttl),
        blockDuration: await resolve(routeBlockDuration ?? throttler.blockDuration ?? throttler.ttl),
        throttler,
        getTracker,
        generateKey,
      } as ThrottlerRequest));
    }

    return results.every(Boolean);
  }
}
