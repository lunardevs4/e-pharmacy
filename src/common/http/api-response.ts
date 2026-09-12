import { randomUUID } from 'crypto';
import { Request, Response } from 'express';

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMIT_EXCEEDED'
  | 'INTERNAL_ERROR';

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  timestamp: string;
  requestId: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: ApiErrorCode;
    message: string;
    details?: unknown;
  };
  statusCode: number;
  path: string;
  timestamp: string;
  requestId: string;
}

export function getRequestId(request: Request, response: Response) {
  const header = request.header('x-request-id');
  const requestId =
    typeof header === 'string' && /^[\w:.\-]{1,128}$/.test(header)
      ? header
      : randomUUID();

  response.setHeader('X-Request-Id', requestId);
  return requestId;
}

export function errorCodeForStatus(status: number): ApiErrorCode {
  switch (status) {
    case 400:
      return 'BAD_REQUEST';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 429:
      return 'RATE_LIMIT_EXCEEDED';
    default:
      return 'INTERNAL_ERROR';
  }
}

export function sendApiError(
  request: Request,
  response: Response,
  statusCode: number,
  code: ApiErrorCode,
  message: string,
  details?: unknown,
) {
  const error: ApiErrorResponse = {
    success: false,
    error: {
      code,
      message,
      ...(details === undefined ? {} : { details }),
    },
    statusCode,
    path: request.originalUrl || request.url,
    timestamp: new Date().toISOString(),
    requestId: getRequestId(request, response),
  };

  return response.status(statusCode).json(error);
}
