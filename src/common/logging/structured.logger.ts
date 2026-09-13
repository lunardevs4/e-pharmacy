import { Injectable, LoggerService } from '@nestjs/common';

@Injectable()
export class StructuredLogger implements LoggerService {
  private write(
    level: string,
    message: unknown,
    context?: string,
    stack?: string,
  ) {
    const fields =
      message && typeof message === 'object' && !Array.isArray(message)
        ? (message as Record<string, unknown>)
        : {};
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      service: process.env.SERVICE_NAME || 'e-pharmacy-api',
      environment: process.env.NODE_ENV || 'development',
      ...fields,
      ...(context ? { context } : {}),
      ...(Object.keys(fields).length
        ? {}
        : {
            message:
              message instanceof Error ? message.message : String(message),
          }),
      ...(stack
        ? { stack }
        : message instanceof Error && message.stack
          ? { stack: message.stack }
          : {}),
    };
    const output = JSON.stringify(entry);
    if (level === 'error' || level === 'fatal') console.error(output);
    else if (level === 'warn') console.warn(output);
    else console.log(output);
  }

  log(message: unknown, context?: string) {
    this.write('info', message, context);
  }
  error(message: unknown, stack?: string, context?: string) {
    this.write('error', message, context, stack);
  }
  warn(message: unknown, context?: string) {
    this.write('warn', message, context);
  }
  debug(message: unknown, context?: string) {
    this.write('debug', message, context);
  }
  verbose(message: unknown, context?: string) {
    this.write('trace', message, context);
  }
  fatal(message: unknown, context?: string) {
    this.write('fatal', message, context);
  }
}
