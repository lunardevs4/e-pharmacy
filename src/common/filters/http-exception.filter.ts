import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
  errorCodeForStatus,
  getRequestId,
  ApiErrorCode,
} from '../http/api-response';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse = isHttpException ? exception.getResponse() : null;
    const responseObject =
      exceptionResponse && typeof exceptionResponse === 'object'
        ? (exceptionResponse as Record<string, unknown>)
        : undefined;
    const rawMessage = responseObject?.message ?? exceptionResponse;
    const details = Array.isArray(rawMessage) ? rawMessage : undefined;
    const message = details
      ? 'Request validation failed'
      : typeof rawMessage === 'string'
        ? rawMessage
        : isHttpException
          ? exception.message
          : 'An unexpected error occurred';
    const code = details
      ? 'VALIDATION_ERROR'
      : typeof responseObject?.code === 'string'
        ? (responseObject.code as ApiErrorCode)
        : errorCodeForStatus(status);
    const requestId = getRequestId(request, response);

    const errorResponse = {
      success: false,
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
      statusCode: status,
      path: request.url,
      timestamp: new Date().toISOString(),
      requestId,
    };

    response.status(status).json(errorResponse);
  }
}
