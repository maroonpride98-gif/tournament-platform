import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { Request, Response } from 'express';

@Catch()
export class SentryExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.message
        : 'Internal server error';

    // Only capture 5xx errors to Sentry (not client errors like 400, 401, 404)
    if (status >= 500) {
      Sentry.withScope((scope) => {
        scope.setExtra('url', request.url);
        scope.setExtra('method', request.method);
        scope.setExtra('body', request.body);
        scope.setExtra('query', request.query);
        scope.setExtra('headers', request.headers);

        if ('user' in request && request.user) {
          const user = request.user as { id?: string; email?: string; username?: string };
          scope.setUser({
            id: user.id,
            email: user.email,
            username: user.username,
          });
        }

        Sentry.captureException(exception);
      });
    }

    response.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
