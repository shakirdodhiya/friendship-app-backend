import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Machine-readable error codes the mobile app can branch on
 * (e.g. show the coins sheet on INSUFFICIENT_COINS, the Pro upsell on CHAT_CAPACITY_REACHED).
 */
export const ErrorCode = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL: 'INTERNAL',

  OTP_INVALID: 'OTP_INVALID',
  OTP_EXPIRED: 'OTP_EXPIRED',
  OTP_TOO_MANY_ATTEMPTS: 'OTP_TOO_MANY_ATTEMPTS',
  OTP_RESEND_TOO_SOON: 'OTP_RESEND_TOO_SOON',
  REFRESH_TOKEN_INVALID: 'REFRESH_TOKEN_INVALID',

  ONBOARDING_INCOMPLETE: 'ONBOARDING_INCOMPLETE',
  PRO_REQUIRED: 'PRO_REQUIRED',
  INSUFFICIENT_COINS: 'INSUFFICIENT_COINS',
  CHAT_CAPACITY_REACHED: 'CHAT_CAPACITY_REACHED',
  CHAT_CLOSED: 'CHAT_CLOSED',
  CHAT_EXPIRED: 'CHAT_EXPIRED',
  USER_BLOCKED: 'USER_BLOCKED',
  QUICK_MATCH_IN_PROGRESS: 'QUICK_MATCH_IN_PROGRESS',
  QUICK_MATCH_NOT_FINISHED: 'QUICK_MATCH_NOT_FINISHED',
  PAYMENT_PROVIDER_UNAVAILABLE: 'PAYMENT_PROVIDER_UNAVAILABLE',
  ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',
  LOCATION_NOT_SUPPORTED: 'LOCATION_NOT_SUPPORTED',

  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/** Body of every error response. */
export interface ErrorBody {
  statusCode: number;
  code: ErrorCode | string;
  message: string;
  details?: unknown;
}

export class AppException extends HttpException {
  constructor(status: HttpStatus, code: ErrorCode, message: string, details?: unknown) {
    super({ statusCode: status, code, message, details } satisfies ErrorBody, status);
  }
}

export const notFound = (what: string) => new AppException(HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND, `${what} not found`);
export const forbidden = (message: string, code: ErrorCode = ErrorCode.FORBIDDEN) =>
  new AppException(HttpStatus.FORBIDDEN, code, message);
export const conflict = (message: string, code: ErrorCode = ErrorCode.CONFLICT) =>
  new AppException(HttpStatus.CONFLICT, code, message);
export const badRequest = (message: string, code: ErrorCode = ErrorCode.VALIDATION_FAILED, details?: unknown) =>
  new AppException(HttpStatus.BAD_REQUEST, code, message, details);
export const insufficientCoins = (needed: number, balance: number) =>
  new AppException(HttpStatus.PAYMENT_REQUIRED, ErrorCode.INSUFFICIENT_COINS, 'Not enough coins', {
    needed,
    balance,
  });