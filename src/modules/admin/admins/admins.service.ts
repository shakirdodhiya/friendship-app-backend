import { Inject, Injectable } from '@nestjs/common';
import { asc, eq, sql } from 'drizzle-orm';

import { badRequest, conflict, notFound } from '../../../common/errors';
import { DB, type Database } from '../../../database/database.module';
import { adminUsers, type AdminUser } from '../../../database/schema';
import { AuditService } from '../common/audit.service';
import { hashPassword } from '../common/password';
import type { AdminPrincipal } from '../common/types';
import { toAdminDto } from './admins.mapper';
import type { AdminDto, CreateAdminDto, UpdateAdminDto } from './dto/admins.dto';

@Injectable()
export class AdminsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<AdminDto[]> {
    const rows = await this.db.select().from(adminUsers).orderBy(asc(adminUsers.createdAt));
    return rows.map(toAdminDto);
  }

  async create(actor: AdminPrincipal, dto: CreateAdminDto): Promise<AdminDto> {
    const passwordHash = await hashPassword(dto.password);
    return this.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(adminUsers)
        .values({ email: dto.email, name: dto.name, role: dto.role, passwordHash })
        .onConflictDoNothing()
        .returning();
      if (!created) throw conflict('An admin with this email already exists');
      await this.audit.record(
        actor,
        { action: 'admin.create', targetType: 'admin', targetId: created.id, metadata: { email: dto.email, role: dto.role } },
        tx,
      );
      return toAdminDto(created);
    });
  }

  async update(actor: AdminPrincipal, adminId: string, dto: UpdateAdminDto): Promise<AdminDto> {
    const target = await this.find(adminId);
    if (target.id === actor.id && (dto.disabled || (dto.role && dto.role !== target.role))) {
      throw badRequest('You cannot deactivate yourself or change your own role');
    }

    const changes: Partial<typeof adminUsers.$inferInsert> = {};
    if (dto.name !== undefined) changes.name = dto.name;
    if (dto.role !== undefined) changes.role = dto.role;
    if (dto.disabled !== undefined) changes.disabledAt = dto.disabled ? (target.disabledAt ?? new Date()) : null;
    if (dto.password !== undefined) changes.passwordHash = await hashPassword(dto.password);
    // Signs the admin out when they lose access or their password is reset.
    const revoke = dto.password !== undefined || dto.disabled === true;

    return this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(adminUsers)
        .set({ ...changes, ...(revoke ? { tokenVersion: sql`${adminUsers.tokenVersion} + 1` } : {}) })
        .where(eq(adminUsers.id, adminId))
        .returning();
      await this.audit.record(
        actor,
        {
          action: 'admin.update',
          targetType: 'admin',
          targetId: adminId,
          metadata: { ...dto, password: dto.password ? '(reset)' : undefined },
        },
        tx,
      );
      return toAdminDto(updated);
    });
  }

  async remove(actor: AdminPrincipal, adminId: string): Promise<void> {
    if (adminId === actor.id) throw badRequest('You cannot delete yourself');
    const target = await this.find(adminId);
    await this.db.transaction(async (tx) => {
      await tx.delete(adminUsers).where(eq(adminUsers.id, adminId));
      await this.audit.record(
        actor,
        { action: 'admin.delete', targetType: 'admin', targetId: adminId, metadata: { email: target.email } },
        tx,
      );
    });
  }

  private async find(adminId: string): Promise<AdminUser> {
    const [admin] = await this.db.select().from(adminUsers).where(eq(adminUsers.id, adminId));
    if (!admin) throw notFound('Admin');
    return admin;
  }
}
