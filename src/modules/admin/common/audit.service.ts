import { Inject, Injectable } from '@nestjs/common';

import { DB, type Database, type DbExecutor } from '../../../database/database.module';
import { adminAuditLogs } from '../../../database/schema';
import type { AdminPrincipal } from './types';

export interface AuditEntry {
  action: string;
  targetType: string;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  constructor(@Inject(DB) private readonly db: Database) {}

  /** Pass the open transaction so the log row commits (or rolls back) with the change itself. */
  async record(admin: AdminPrincipal, entry: AuditEntry, executor: DbExecutor = this.db): Promise<void> {
    await executor.insert(adminAuditLogs).values({
      adminId: admin.id,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId ?? null,
      metadata: entry.metadata,
    });
  }
}
