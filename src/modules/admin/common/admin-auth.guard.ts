import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { eq } from 'drizzle-orm';
import type { Request } from 'express';

import { forbidden } from '../../../common/errors';
import { DB, type Database } from '../../../database/database.module';
import { adminUsers } from '../../../database/schema';
import { extractBearer } from '../../auth/firebase-auth.guard';
import { AdminPublic, MinRole } from './admin-metadata';
import { AdminTokenService } from './admin-token.service';
import { ADMIN_ROLE_RANK, type AdminPrincipal } from './types';

/** Verifies the admin token, reloads the admin (so deactivation and role changes apply at once) and checks `@MinRole`. */
@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: AdminTokenService,
    @Inject(DB) private readonly db: Database,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride(AdminPublic, targets)) return true;

    const request = context.switchToHttp().getRequest<Request & { admin?: AdminPrincipal }>();
    const token = extractBearer(request.headers.authorization);
    const payload = token ? this.tokens.verify(token) : undefined;
    if (!payload) throw new UnauthorizedException('Invalid or expired admin session');

    const [admin] = await this.db
      .select({
        id: adminUsers.id,
        email: adminUsers.email,
        name: adminUsers.name,
        role: adminUsers.role,
        tokenVersion: adminUsers.tokenVersion,
        disabledAt: adminUsers.disabledAt,
      })
      .from(adminUsers)
      .where(eq(adminUsers.id, payload.sub));
    if (!admin || admin.disabledAt || admin.tokenVersion !== payload.ver) {
      throw new UnauthorizedException('Invalid or expired admin session');
    }

    const minRole = this.reflector.getAllAndOverride(MinRole, targets);
    if (minRole && ADMIN_ROLE_RANK[admin.role] < ADMIN_ROLE_RANK[minRole]) {
      throw forbidden(`Requires the ${minRole} role`);
    }

    request.admin = { id: admin.id, email: admin.email, name: admin.name, role: admin.role };
    return true;
  }
}
