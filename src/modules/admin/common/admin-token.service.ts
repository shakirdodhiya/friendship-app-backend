import { Injectable, Logger } from '@nestjs/common';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import { AppConfig } from '../../../config/app-config.service';

export interface AdminTokenPayload {
  /** Admin id. */
  sub: string;
  /** `admin_users.token_version` at sign-in. */
  ver: number;
  typ: 'admin';
  iat: number;
  exp: number;
}

const b64url = (input: Buffer | string) => Buffer.from(input).toString('base64url');
const HEADER = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));

/** Signs and verifies the admin portal's HS256 JWTs. Separate from Firebase tokens used by the app. */
@Injectable()
export class AdminTokenService {
  private readonly logger = new Logger(AdminTokenService.name);
  private readonly secret: Buffer;
  private readonly ttlSeconds: number;

  constructor(config: AppConfig) {
    const secret = config.get('ADMIN_JWT_SECRET');
    if (!secret) {
      this.logger.warn('ADMIN_JWT_SECRET is not set — using a random secret; admin sessions end on restart');
    }
    this.secret = secret ? Buffer.from(secret) : randomBytes(48);
    this.ttlSeconds = Math.round(config.get('ADMIN_TOKEN_TTL_HOURS') * 3600);
  }

  sign(adminId: string, tokenVersion: number): { token: string; expiresAt: Date } {
    const iat = Math.floor(Date.now() / 1000);
    const payload: AdminTokenPayload = { sub: adminId, ver: tokenVersion, typ: 'admin', iat, exp: iat + this.ttlSeconds };
    const body = `${HEADER}.${b64url(JSON.stringify(payload))}`;
    return { token: `${body}.${this.signature(body)}`, expiresAt: new Date(payload.exp * 1000) };
  }

  /** Returns the payload, or undefined when the token is malformed, tampered with or expired. */
  verify(token: string): AdminTokenPayload | undefined {
    const [header, payload, signature] = token.split('.');
    if (!header || !payload || !signature || header !== HEADER) return undefined;

    const expected = Buffer.from(this.signature(`${header}.${payload}`));
    const actual = Buffer.from(signature);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return undefined;

    try {
      const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as AdminTokenPayload;
      if (decoded.typ !== 'admin' || typeof decoded.sub !== 'string' || typeof decoded.exp !== 'number') return undefined;
      if (decoded.exp * 1000 <= Date.now()) return undefined;
      return decoded;
    } catch {
      return undefined;
    }
  }

  private signature(input: string): string {
    return createHmac('sha256', this.secret).update(input).digest('base64url');
  }
}
