import type { AdminUser } from '../../../database/schema';
import type { AdminDto } from './dto/admins.dto';

export const toAdminDto = (admin: AdminUser): AdminDto => ({
  id: admin.id,
  email: admin.email,
  name: admin.name,
  role: admin.role,
  disabled: admin.disabledAt !== null,
  lastLoginAt: admin.lastLoginAt,
  createdAt: admin.createdAt,
});
