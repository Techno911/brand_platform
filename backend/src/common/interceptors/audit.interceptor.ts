import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';

/**
 * Light-weight request/response interceptor. Writes elapsed ms for each
 * request to the application log. Actual audit persistence lives inside
 * dedicated services (AuditService) — this interceptor intentionally stays
 * side-effect-free for the DB.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(ctx: ExecutionContext, next: CallHandler<unknown>): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<{
      method: string;
      originalUrl: string;
      user?: { id: string };
    }>();
    const started = Date.now();

    return next.handle().pipe(
      tap(() => {
        const elapsed = Date.now() - started;
        const who = req.user?.id ?? '-';
        this.logger.log(
          `${req.method} ${req.originalUrl} user=${who} ${elapsed}ms`,
        );
      }),
    );
  }
}
