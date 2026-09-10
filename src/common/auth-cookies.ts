import { Request, Response } from 'express';

export const ACCESS_TOKEN_COOKIE = 'epharmacy_access';
export const REFRESH_TOKEN_COOKIE = 'epharmacy_refresh';

const DAY_MS = 24 * 60 * 60 * 1000;

function durationToMs(value: string | undefined, fallbackMs: number): number {
  if (!value) return fallbackMs;
  const match = value.trim().match(/^(\d+)\s*(s|m|h|d)?$/i);
  if (!match) return fallbackMs;
  const amount = Number(match[1]);
  const unit = (match[2] || 'ms').toLowerCase();
  const multiplier = unit === 'd' ? DAY_MS : unit === 'h' ? 60 * 60 * 1000 : unit === 'm' ? 60 * 1000 : unit === 's' ? 1000 : 1;
  return amount * multiplier;
}

export function authCookieOptions(maxAge: number) {
  const isProduction = process.env.NODE_ENV === 'production';
  const sameSite = (process.env.COOKIE_SAME_SITE || (isProduction ? 'none' : 'lax')) as 'lax' | 'strict' | 'none';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite,
    path: '/',
    maxAge,
  } as const;
}

export function setAuthCookies(response: Response, accessToken: string, refreshToken: string) {
  response.cookie(
    ACCESS_TOKEN_COOKIE,
    accessToken,
    authCookieOptions(durationToMs(process.env.JWT_EXPIRES_IN, 60 * 60 * 1000)),
  );
  response.cookie(
    REFRESH_TOKEN_COOKIE,
    refreshToken,
    authCookieOptions(durationToMs(process.env.REFRESH_TOKEN_EXPIRES_IN, 7 * DAY_MS)),
  );
}

export function clearAuthCookies(response: Response) {
  response.clearCookie(ACCESS_TOKEN_COOKIE, { ...authCookieOptions(0), maxAge: undefined });
  response.clearCookie(REFRESH_TOKEN_COOKIE, { ...authCookieOptions(0), maxAge: undefined });
}

export function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    const key = part.slice(0, separator).trim();
    if (key !== name) continue;
    return decodeURIComponent(part.slice(separator + 1).trim());
  }
  return undefined;
}

export function getCookieMaxAge(value: string | undefined, fallbackMs: number) {
  return durationToMs(value, fallbackMs);
}
