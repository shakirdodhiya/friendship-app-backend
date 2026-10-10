import { Get, Inject, Query } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { and, count, desc, eq, ilike, SQL } from 'drizzle-orm';

import { DB, type Database } from '../../../database/database.module';
import { adminAuditLogs, adminUsers } from '../../../database/schema';
import { likePattern, offsetOf, pageOf } from '../common/admin-page.dto';
import { AdminController, MinRole } from '../common/admin.decorators';
import { AuditLogPageDto, AuditQueryDto } from './dto/audit.dto';

@AdminController('audit-logs', 'Audit log')
@MinRole('admin')
export class AuditController {
  constructor(@Inject(DB) private readonly db: Database) {}

  @Get()
  @ApiOperation({ summary: 'What admins changed, newest first', description: '`search` matches the action name.' })
  async list(@Query() query: AuditQueryDto): Promise<AuditLogPageDto> {
    const conditions: SQL[] = [];
    if (query.adminId) conditions.push(eq(adminAuditLogs.adminId, query.adminId));
    if (query.targetType) conditions.push(eq(adminAuditLogs.targetType, query.targetType));
    if (query.targetId) conditions.push(eq(adminAuditLogs.targetId, query.targetId));
    if (query.search) conditions.push(ilike(adminAuditLogs.action, likePattern(query.search)));
    const where = and(...conditions);

    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select({ log: adminAuditLogs, adminName: adminUsers.name, adminEmail: adminUsers.email })
        .from(adminAuditLogs)
        .leftJoin(adminUsers, eq(adminUsers.id, adminAuditLogs.adminId))
        .where(where)
        .orderBy(desc(adminAuditLogs.createdAt))
        .limit(query.pageSize)
        .offset(offsetOf(query)),
      this.db.select({ total: count() }).from(adminAuditLogs).where(where),
    ]);

    const items = rows.map(({ log, adminName, adminEmail }) => ({
      id: log.id,
      admin: log.adminId && adminName && adminEmail ? { id: log.adminId, name: adminName, email: adminEmail } : null,
      action: log.action,
      targetType: log.targetType,
      targetId: log.targetId,
      metadata: log.metadata,
      createdAt: log.createdAt,
    }));
    return pageOf(items, total, query);
  }
}
