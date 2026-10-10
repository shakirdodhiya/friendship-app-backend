import { Reflector } from '@nestjs/core';

import type { AdminRole } from '../../../database/schema';

/** Lowest role allowed on a route or controller. Without it any signed-in admin may call it. */
export const MinRole = Reflector.createDecorator<AdminRole>();

/** Skips `AdminAuthGuard`, e.g. for the login route. */
export const AdminPublic = Reflector.createDecorator<true>({ transform: () => true });
