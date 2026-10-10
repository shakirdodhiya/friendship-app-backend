import type { AdminRole } from '../../../database/schema';

/** What `AdminAuthGuard` attaches to `request.admin`. */
export interface AdminPrincipal {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
}

/** Higher can do everything lower can. */
export const ADMIN_ROLE_RANK: Record<AdminRole, number> = { moderator: 0, admin: 1, super_admin: 2 };
