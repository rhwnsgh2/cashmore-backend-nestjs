import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MetricsService } from './metrics.service';
import { Request } from 'express';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse();

    // health check는 제외
    if (request.path === '/health') {
      return next.handle();
    }

    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const responseTime = Date.now() - startTime;
          const endpoint = this.getEndpoint(request);
          this.metricsService.recordRequest(
            endpoint,
            responseTime,
            response.statusCode,
          );
        },
        error: (error: unknown) => {
          const responseTime = Date.now() - startTime;
          const endpoint = this.getEndpoint(request);
          const statusCode =
            error instanceof HttpException ? error.getStatus() : 500;
          this.metricsService.recordRequest(endpoint, responseTime, statusCode);
        },
      }),
    );
  }

  private getEndpoint(request: Request): string {
    // route path가 있으면 사용 (파라미터화된 경로), 없으면 실제 path 사용
    const routePath = (request as unknown as { route?: { path?: string } })
      .route?.path;
    const method = request.method;
    const path = routePath || request.path;

    return `${method} ${path}`;
  }
}
