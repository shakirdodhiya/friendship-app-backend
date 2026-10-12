import { CanActivate, ExecutionContext, Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { and, eq, lt, sql } from 'drizzle-orm';
import type { Request } from 'express';

import { Public } from '../../common/decorators/public.decorator';
import { ErrorCode, forbidden } from '../../common/errors';
import type { AuthUser } from '../../common/types/auth-user';
import { DB, type Database } from '../../database/database.module';
import { users } from '../../database/schema';
import { FirebaseService } from '../firebase/firebase.service';
import { AuthService } from './auth.service';

export function extractBearer(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const [scheme, value] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && value ? value : undefined;
}

/**
 * Global guard: every route needs `Authorization: Bearer <Firebase ID token>` unless marked `@Public()`.
 * A valid token for a uid we have not seen yet creates the user, so any endpoint works right after sign-in.
 */
@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  private readonly logger = new Logger(FirebaseAuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly firebase: FirebaseService,
    private readonly auth: AuthService,
    @Inject(DB) private readonly db: Database,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride(Public, [context.getHandler(), context.getClass()]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const token = extractBearer(request.headers.authorization);
    if (!token) throw new UnauthorizedException('Missing bearer token');

    request.user = await this.authenticate(token);
    return true;
  }

  /** Verifies a Firebase ID token and returns our user. Shared with the WebSocket gateway. */
  async authenticate(idToken: string): Promise<AuthUser> {
    const decoded = await this.firebase.verifyIdToken(idToken);

    const existing = await this.auth.findUser(decoded.uid);
    if (existing?.suspendedAt) throw forbidden('This account has been suspended', ErrorCode.ACCOUNT_SUSPENDED);
    const id = existing?.id ?? (await this.auth.resolve(decoded)).id;

    // Presence: bump last_active_at at most once a minute. Not awaited — it must never fail a request.
    this.db
      .update(users)
      .set({ lastActiveAt: sql`now()` })
      .where(and(eq(users.id, id), lt(users.lastActiveAt, sql`now() - interval '1 minute'`)))
      .catch((error) => this.logger.warn(`Failed to update presence: ${error}`));

    return { id, firebaseUid: decoded.uid };
  }
}