import { Transform } from 'class-transformer';
import { BadRequestException } from '@nestjs/common';

function parseToISODateTime(value: any): any {
  if (value === undefined || value === null || value === '') return value;
  if (value instanceof Date) {
    if (isNaN(value.getTime())) {
      throw new BadRequestException('Invalid date value');
    }
    return value.toISOString();
  }
  if (typeof value === 'number') {
    const d = new Date(value);
    if (isNaN(d.getTime())) throw new BadRequestException('Invalid date timestamp');
    return d.toISOString();
  }
  if (typeof value !== 'string') return value;

  const trimmed = value.trim();
  if (!trimmed) return value;

  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(trimmed);
  if (isDateOnly) {
    const d = new Date(trimmed + 'T00:00:00.000Z');
    if (isNaN(d.getTime())) {
      throw new BadRequestException(`Invalid date: ${trimmed}`);
    }
    return d.toISOString();
  }

  const d = new Date(trimmed);
  if (isNaN(d.getTime())) {
    throw new BadRequestException(`Invalid date format: ${trimmed}. Expected ISO-8601 (e.g. 2027-12-31 or 2027-12-31T23:59:59Z)`);
  }
  return d.toISOString();
}

export function TransformToISODateTime() {
  return Transform(({ value, key }) => {
    try {
      return parseToISODateTime(value);
    } catch (e: any) {
      throw new BadRequestException(`${key}: ${e.message}`);
    }
  });
}

export function TransformToISODateTimeOptional() {
  return Transform(({ value, key }) => {
    if (value === undefined || value === null || value === '') return undefined;
    try {
      return parseToISODateTime(value);
    } catch (e: any) {
      throw new BadRequestException(`${key}: ${e.message}`);
    }
  });
}
