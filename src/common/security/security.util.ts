import { BadRequestException } from '@nestjs/common';
import * as xss from 'xss';

export const SQL_INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT|DECLARE)\b)/i,
  /(--|#|\/\*|\*\/)/,
  /('|")\s*(OR|AND)\s*('|")?\d+('|")?\s*=\s*('|")?\d+/i,
  /\bUNION\b\s*\b(ALL\s*)?\bSELECT\b/i,
  /\bEXEC\s*\bsp_\w+/i,
  /;\s*(DROP|DELETE|UPDATE|INSERT|ALTER|CREATE)\b/i,
  /\bWAITFOR\s*\bDELAY\b/i,
  /\bxp_\w+/i,
];

export const ALLOWED_AUDIT_ENTITY_TYPES = [
  'User',
  'Pharmacy',
  'Medicine',
  'Category',
  'Manufacturer',
  'Inventory',
  'Prescription',
  'Reservation',
  'ReminderSchedule',
  'Notification',
  'Patient',
  'SystemSetting',
];

export const ALLOWED_AUDIT_ACTIONS = [
  'CREATE',
  'READ',
  'UPDATE',
  'DELETE',
  'SOFT_DELETE',
  'APPROVE',
  'REJECT',
  'LOGIN',
  'LOGOUT',
  'REGISTER',
  'CANCEL',
  'COMPLETE',
  'MARK_READ',
  'UPLOAD',
  'DISPENSE',
];

export function sanitizeXss(input: string): string {
  if (!input || typeof input !== 'string') return input;
  return xss.filterXSS(input, {
    whiteList: {},
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script', 'style', 'iframe'],
    onTag: (_tag, _html, _options) => '',
  });
}

export function sanitizeDeep<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return sanitizeXss(value) as T;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return value;
  if (value instanceof Date) return value;
  if (value instanceof RegExp) return value;
  if (typeof (Buffer) !== 'undefined' && Buffer.isBuffer(value)) return value;
  if (Array.isArray(value)) return value.map((item) => sanitizeDeep(item)) as T;
  if (typeof value === 'object') {
    const proto = Object.getPrototypeOf(value);
    if (proto !== null && proto !== Object.prototype) {
      return value;
    }
    const sanitized: Record<string, any> = {};
    for (const [k, v] of Object.entries(value as Record<string, any>)) {
      sanitized[k] = sanitizeDeep(v);
    }
    return sanitized as T;
  }
  return value;
}

export function detectSqlInjection(input: string): boolean {
  if (!input || typeof input !== 'string') return false;
  return SQL_INJECTION_PATTERNS.some((pattern) => pattern.test(input));
}

export function validateSafeString(input: string, fieldName: string, maxLength = 500): string {
  if (!input) return input;
  if (typeof input !== 'string') {
    throw new BadRequestException(`${fieldName} must be a string`);
  }
  if (input.length > maxLength) {
    throw new BadRequestException(`${fieldName} exceeds maximum length of ${maxLength}`);
  }
  if (detectSqlInjection(input)) {
    throw new BadRequestException(`${fieldName} contains disallowed characters or patterns`);
  }
  return sanitizeXss(input);
}

export function validateUuid(input: string, fieldName: string): string {
  if (!input) return input;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(input)) {
    throw new BadRequestException(`${fieldName} is not a valid UUID`);
  }
  return input;
}

export function validateEnum<T extends Record<string, string>>(
  input: string,
  enumDef: T,
  fieldName: string,
): T[keyof T] {
  if (!input) return input as T[keyof T];
  const values = Object.values(enumDef);
  if (!values.includes(input as any)) {
    throw new BadRequestException(
      `${fieldName} must be one of: ${values.join(', ')}`,
    );
  }
  return input as T[keyof T];
}

export function validateWhitelist(
  input: string,
  allowed: readonly string[],
  fieldName: string,
): string {
  if (!input) return input;
  if (!allowed.includes(input)) {
    throw new BadRequestException(
      `${fieldName} must be one of: ${allowed.join(', ')}`,
    );
  }
  return input;
}

export function validatePositiveInt(input: string | number | undefined, fieldName: string, defaultValue: number): number {
  if (input === undefined || input === null || input === '') return defaultValue;
  const n = typeof input === 'string' ? parseInt(input, 10) : input;
  if (isNaN(n) || n < 0) {
    throw new BadRequestException(`${fieldName} must be a positive integer`);
  }
  return n;
}

export function validateDate(input: string | Date | undefined, fieldName: string): Date | undefined {
  if (input === undefined || input === null || input === '') return undefined;
  if (input instanceof Date) {
    if (isNaN(input.getTime())) {
      throw new BadRequestException(`${fieldName} is not a valid date`);
    }
    return input;
  }
  if (typeof input === 'number') {
    const d = new Date(input);
    if (isNaN(d.getTime())) throw new BadRequestException(`${fieldName} is not a valid date`);
    return d;
  }
  if (typeof input !== 'string') {
    throw new BadRequestException(`${fieldName} must be a string, number, or Date`);
  }
  const d = new Date(input);
  if (isNaN(d.getTime())) {
    throw new BadRequestException(`${fieldName} is not a valid date`);
  }
  return d;
}

export function normalizeDate(input: string | Date | undefined | null): Date | undefined {
  if (input === undefined || input === null || input === '') return undefined;
  if (input instanceof Date) return isNaN(input.getTime()) ? undefined : input;
  const d = new Date(typeof input === 'number' ? input : String(input));
  return isNaN(d.getTime()) ? undefined : d;
}

export function validateGeoCoordinate(input: string | number | undefined, fieldName: string, range: [number, number]): number | undefined {
  if (input === undefined || input === null || input === '') return undefined;
  const n = typeof input === 'string' ? parseFloat(input) : input;
  if (isNaN(n) || n < range[0] || n > range[1]) {
    throw new BadRequestException(`${fieldName} must be a number between ${range[0]} and ${range[1]}`);
  }
  return n;
}
