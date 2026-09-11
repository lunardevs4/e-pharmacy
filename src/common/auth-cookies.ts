import { Request, Response } from 'express';
import { randomBytes } from 'crypto';

export const ACCESS_TOKEN_COOKIE = 'epharmacy_access';
export const REFRESH_TOKEN_COOKIE = 'epharmacy_refresh';
export const CSRF_TOKEN_COOKIE = 'epharmacy_csrf';
export const CSRF_TOKEN_HEADER = 'x-csrf-token';

const DAY_MS = 24 * 60 * 60 * 1000;

function durationToMs(value: string | undefined, fallbackMs: number): number {
  if (!value) return fallbackMs;
  const match = value.trim().match(/^(\d+)\s*(s|m|h|d)?$/i);
  if (!match) return fallbackMs;
  const amount = Number(match[1]);
  const unit = (match[2] || 'ms').toLowerCase();
  const multiplier =
    unit === 'd'
      ? DAY_MS
      : unit === 'h'
        ? 60 * 60 * 1000
        : unit === 'm'
          ? 60 * 1000
          : unit === 's'
            ? 1000
            : 1;
  return amount * multiplier;
}

export function authCookieOptions(maxAge: number) {
  // A hosted frontend and API are commonly on different sites. In that case
  // the auth cookie must be Secure + SameSite=None to be sent with XHR/fetch.
  // The HTTPS frontend URL also covers deployments that do not set NODE_ENV.
  const isSecureDeployment =
    process.env.NODE_ENV === 'production' ||
    process.env.FRONTEND_URL?.startsWith('https://');
  const sameSite = (process.env.COOKIE_SAME_SITE ||
    (isSecureDeployment ? 'none' : 'lax')) as 'lax' | 'strict' | 'none';
  return {
    httpOnly: true,
    secure: isSecureDeployment,
    sameSite,
    path: '/',
    maxAge,
  } as const;
}

export function setAuthCookies(
  response: Response,
  accessToken: string,
  refreshToken: string,
) {
  response.cookie(
    ACCESS_TOKEN_COOKIE,
    accessToken,
    authCookieOptions(durationToMs(process.env.JWT_EXPIRES_IN, 60 * 60 * 1000)),
  );
  response.cookie(
    REFRESH_TOKEN_COOKIE,
    refreshToken,
    authCookieOptions(
      durationToMs(process.env.REFRESH_TOKEN_EXPIRES_IN, 7 * DAY_MS),
    ),
  );
}

export function csrfCookieOptions() {
  return {
    ...authCookieOptions(0),
    httpOnly: false,
    maxAge: undefined,
  } as const;
}

export function issueCsrfToken(
  response: Response,
  token = randomBytes(32).toString('hex'),
) {
  response.cookie(CSRF_TOKEN_COOKIE, token, csrfCookieOptions());
  return token;
}

export function clearAuthCookies(response: Response) {
  response.clearCookie(ACCESS_TOKEN_COOKIE, {
    ...authCookieOptions(0),
    maxAge: undefined,
  });
  response.clearCookie(REFRESH_TOKEN_COOKIE, {
    ...authCookieOptions(0),
    maxAge: undefined,
  });
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
