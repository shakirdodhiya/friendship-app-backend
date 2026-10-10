import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';

import { AppException, ErrorCode, notFound } from '../../../common/errors';
import { DB, type Database } from '../../../database/database.module';
import { adminUsers, type AdminUser } from '../../../database/schema';
import { toAdminDto } from '../admins/admins.mapper';
import type { AdminDto } from '../admins/dto/admins.dto';
import { AdminTokenService } from '../common/admin-token.service';
import { DUMMY_HASH, hashPassword, verifyPassword } from '../common/password';
import type { AdminSessionDto } from './dto/admin-auth.dto';

const invalidCredentials = () =>
  new AppException(HttpStatus.UNAUTHORIZED, ErrorCode.INVALID_CREDENTIALS, 'Incorrect email or password');

@Injectable()
export class AdminAuthService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly tokens: AdminTokenService,
  ) {}

  async login(email: string, password: string): Promise<AdminSessionDto> {
    const [admin] = await this.db
      .select()
      .from(adminUsers)
      .where(sql`lower(${adminUsers.email}) = ${email.toLowerCase()}`);

    // Verify even when the email is unknown so response times don't reveal which emails exist.
    const valid = await verifyPassword(password, admin?.passwordHash ?? (await DUMMY_HASH));
    if (!admin || !valid || admin.disabledAt) throw invalidCredentials();

    const [updated] = await this.db
      .update(adminUsers)
      .set({ lastLoginAt: new Date() })
      .where(eq(adminUsers.id, admin.id))
      .returning();
    return this.session(updated);
  }

  async me(adminId: string): Promise<AdminDto> {
    return toAdminDto(await this.find(adminId));
  }

  /** Changing the password signs out every other session; the returned session replaces the current one. */
  async changePassword(adminId: string, currentPassword: string, newPassword: string): Promise<AdminSessionDto> {
    const admin = await this.find(adminId);
    if (!(await verifyPassword(currentPassword, admin.passwordHash))) {
      throw new AppException(HttpStatus.BAD_REQUEST, ErrorCode.INVALID_CREDENTIALS, 'Current password is incorrect');
    }
    const [updated] = await this.db
      .update(adminUsers)
      .set({ passwordHash: await hashPassword(newPassword), tokenVersion: sql`${adminUsers.tokenVersion} + 1` })
      .where(eq(adminUsers.id, adminId))
      .returning();
    return this.session(updated);
  }

  /** Invalidates every token of this admin, including the current one. */
  async signOutEverywhere(adminId: string): Promise<void> {
    await this.db
      .update(adminUsers)
      .set({ tokenVersion: sql`${adminUsers.tokenVersion} + 1` })
      .where(eq(adminUsers.id, adminId));
  }

  private async find(adminId: string): Promise<AdminUser> {
    const [admin] = await this.db.select().from(adminUsers).where(eq(adminUsers.id, adminId));
    if (!admin) throw notFound('Admin');
    return admin;
  }

  private session(admin: AdminUser): AdminSessionDto {
    const { token, expiresAt } = this.tokens.sign(admin.id, admin.tokenVersion);
    return { accessToken: token, expiresAt, admin: toAdminDto(admin) };
  }
}
