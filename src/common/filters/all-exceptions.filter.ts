import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';

import { ErrorBody, ErrorCode } from '../errors';

const STATUS_CODES: Partial<Record<number, ErrorCode>> = {
  400: ErrorCode.VALIDATION_FAILED,
  401: ErrorCode.UNAUTHORIZED,
  403: ErrorCode.FORBIDDEN,
  404: ErrorCode.NOT_FOUND,
  409: ErrorCode.CONFLICT,
  429: ErrorCode.RATE_LIMITED,
};

/** Postgres error codes we can explain to the client instead of answering 500. */
const PG_ERRORS: Record<string, [HttpStatus, ErrorCode, string]> = {
  '23505': [HttpStatus.CONFLICT, ErrorCode.CONFLICT, 'Resource already exists'],
  '23503': [HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND, 'Referenced resource not found'],
  '23514': [HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_FAILED, 'Value violates a constraint'],
  '22P02': [HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_FAILED, 'Malformed identifier'],
};

/** Drizzle wraps driver errors; walk the cause chain to find the pg error code. */
function pgCode(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth++) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)) return code;
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}

/** Every error leaves the API as `{ statusCode, code, message, details? }`. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost) {
    if (host.getType() !== 'http') throw exception;
    const response = host.switchToHttp().getResponse<Response>();
    const body = this.toBody(exception);
    if (body.statusCode >= 500) this.logger.error(exception);
    response.status(body.statusCode).json(body);
  }

  private toBody(exception: unknown): ErrorBody {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'object' && res !== null && 'code' in res) return res as ErrorBody;

      const raw = typeof res === 'string' ? res : (res as { message?: unknown }).message;
      // ValidationPipe reports an array of messages.
      const isList = Array.isArray(raw);
      return {
        statusCode: status,
        code: STATUS_CODES[status] ?? (status >= 500 ? ErrorCode.INTERNAL : 'HTTP_ERROR'),
        message: isList ? 'Validation failed' : String(raw ?? exception.message),
        ...(isList ? { details: raw } : {}),
      };
    }

    const code = pgCode(exception);
    const mapped = code ? PG_ERRORS[code] : undefined;
    if (mapped) {
      const [statusCode, errorCode, message] = mapped;
      return { statusCode, code: errorCode, message };
    }

    return { statusCode: 500, code: ErrorCode.INTERNAL, message: 'Something went wrong' };
  }
}
