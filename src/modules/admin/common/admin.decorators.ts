import { applyDecorators, Controller, createParamDecorator, ExecutionContext, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import { Public } from '../../../common/decorators/public.decorator';
import { AdminAuthGuard } from './admin-auth.guard';
import type { AdminPrincipal } from './types';

export { AdminPublic, MinRole } from './admin-metadata';

export const ADMIN_BEARER = 'admin';

/**
 * Controller under `/admin/<path>`, authenticated with an admin token instead of a Firebase ID token.
 * `Public()` only opts out of the app's global Firebase guard; `AdminAuthGuard` then does the checking.
 */
export const AdminController = (path: string, tag: string) =>
  applyDecorators(
    Controller(path ? `admin/${path}` : 'admin'),
    ApiTags(`Admin · ${tag}`),
    ApiBearerAuth(ADMIN_BEARER),
    Public(),
    UseGuards(AdminAuthGuard),
  );

/** Injects the signed-in admin. */
export const CurrentAdmin = createParamDecorator((_: unknown, ctx: ExecutionContext): AdminPrincipal => {
  return ctx.switchToHttp().getRequest<Request & { admin: AdminPrincipal }>().admin;
});
