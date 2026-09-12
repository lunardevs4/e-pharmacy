import { Request, Response, NextFunction } from 'express';
import { createHash, timingSafeEqual } from 'crypto';
import {
  CSRF_TOKEN_COOKIE,
  CSRF_TOKEN_HEADER,
  issueCsrfToken,
  readCookie,
} from '../auth-cookies';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const EXEMPT_ROUTES = ['/api/v1/auth/login', '/api/v1/auth/register'];

function tokensMatch(
  expected: string | undefined,
  supplied: string | undefined,
) {
  if (!expected || !supplied) return false;
  const expectedHash = createHash('sha256').update(expected).digest();
  const suppliedHash = createHash('sha256').update(supplied).digest();
  return timingSafeEqual(expectedHash, suppliedHash);
}

export function csrfMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  if (EXEMPT_ROUTES.includes(request.path)) return next();

  let csrfToken = readCookie(request, CSRF_TOKEN_COOKIE);
  if (!csrfToken) {
    csrfToken = issueCsrfToken(response);
    (request as Request & { csrfToken?: string }).csrfToken = csrfToken;
  }

  if (SAFE_METHODS.has(request.method)) return next();

  const suppliedToken = request.get(CSRF_TOKEN_HEADER);
  if (!tokensMatch(csrfToken, suppliedToken)) {
    return response.status(403).json({
      success: false,
      statusCode: 403,
      error: 'Forbidden',
      message: 'Invalid CSRF token',
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }

  return next();
}
