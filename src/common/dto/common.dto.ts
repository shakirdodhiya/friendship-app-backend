import { IsUUID } from 'class-validator';

export class IdParamDto {
  @IsUUID()
  id: string;
}

export class UserIdParamDto {
  @IsUUID()
  userId: string;
}

export class OkResponseDto {
  ok: true;
}

export class ErrorResponseDto {
  statusCode: number;
  /** Machine-readable error code, e.g. `INSUFFICIENT_COINS`. */
  code: string;
  message: string;
  details?: unknown;
}
