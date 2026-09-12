import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { getRequestId } from '../http/api-response';

export interface Response<T> {
  success: true;
  data: T;
  timestamp: string;
  requestId: string;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  Response<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    return next.handle().pipe(
      map((data) => {
        const response = context.switchToHttp().getResponse();
        const request = context.switchToHttp().getRequest();
        return {
          success: true as const,
          data,
          timestamp: new Date().toISOString(),
          requestId: getRequestId(request, response),
        };
      }),
    );
  }
}
