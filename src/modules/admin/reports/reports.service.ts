import { Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq, ilike, or, SQL, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import { notFound } from '../../../common/errors';
import { DB, type Database } from '../../../database/database.module';
import { adminUsers, reports, users } from '../../../database/schema';
import { likePattern, offsetOf, pageOf } from '../common/admin-page.dto';
import { AuditService } from '../common/audit.service';
import type { AdminPrincipal } from '../common/types';
import { userRefColumns } from '../common/user-ref';
import { AdminUsersService } from '../users/admin-users.service';
import type { ReportDto, ReportPageDto, ReportsQueryDto, ResolveReportDto } from './dto/reports.dto';

const reporter = alias(users, 'reporter');
const reported = alias(users, 'reported');

@Injectable()
export class ReportsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly audit: AuditService,
    private readonly users: AdminUsersService,
  ) {}

  async list(query: ReportsQueryDto): Promise<ReportPageDto> {
    const conditions: SQL[] = [];
    if (query.status !== 'all') conditions.push(eq(reports.status, query.status));
    if (query.reason) conditions.push(eq(reports.reason, query.reason));
    if (query.reportedId) conditions.push(eq(reports.reportedId, query.reportedId));
    if (query.search) {
      const pattern = likePattern(query.search);
      conditions.push(
        or(ilike(reported.name, pattern), ilike(reporter.name, pattern), ilike(reports.details, pattern))!,
      );
    }
    const where = and(...conditions);

    const [rows, [{ total }]] = await Promise.all([
      this.select().where(where).orderBy(desc(reports.createdAt)).limit(query.pageSize).offset(offsetOf(query)),
      this.db
        .select({ total: count() })
        .from(reports)
        .innerJoin(reporter, eq(reporter.id, reports.reporterId))
        .innerJoin(reported, eq(reported.id, reports.reportedId))
        .where(where),
    ]);
    return pageOf(rows.map(this.toDto), total, query);
  }

  async resolve(actor: AdminPrincipal, reportId: string, dto: ResolveReportDto): Promise<ReportDto> {
    const [report] = await this.db.select().from(reports).where(eq(reports.id, reportId));
    if (!report) throw notFound('Report');

    const reopened = dto.status === 'open';
    await this.db.transaction(async (tx) => {
      await tx
        .update(reports)
        .set({
          status: dto.status,
          resolutionNote: reopened ? null : dto.note || null,
          resolvedAt: reopened ? null : new Date(),
          resolvedById: reopened ? null : actor.id,
        })
        .where(eq(reports.id, reportId));
      await this.audit.record(
        actor,
        {
          action: `report.${dto.status === 'open' ? 'reopen' : dto.status}`,
          targetType: 'report',
          targetId: reportId,
          metadata: { reportedId: report.reportedId, note: dto.note, suspendUser: dto.suspendUser },
        },
        tx,
      );
    });

    if (dto.suspendUser) {
      await this.users.suspend(actor, report.reportedId, dto.note || `Report ${reportId}: ${report.reason}`);
    }
    const [row] = await this.select().where(eq(reports.id, reportId));
    return this.toDto(row);
  }

  private select() {
    return this.db
      .select({
        report: reports,
        reporter: userRefColumns(reporter, 'reporter'),
        reported: userRefColumns(reported, 'reported'),
        reportedUserReportCount: sql<number>`(select count(*)::int from ${reports} r2 where r2.reported_id = "reports"."reported_id")`,
        resolverName: adminUsers.name,
      })
      .from(reports)
      .innerJoin(reporter, eq(reporter.id, reports.reporterId))
      .innerJoin(reported, eq(reported.id, reports.reportedId))
      .leftJoin(adminUsers, eq(adminUsers.id, reports.resolvedById))
      .$dynamic();
  }

  private toDto = (row: Awaited<ReturnType<ReportsService['select']>>[number]): ReportDto => ({
    id: row.report.id,
    reporter: row.reporter,
    reported: row.reported,
    reason: row.report.reason,
    details: row.report.details,
    status: row.report.status,
    reportedUserReportCount: row.reportedUserReportCount,
    resolutionNote: row.report.resolutionNote,
    resolvedAt: row.report.resolvedAt,
    resolvedBy: row.report.resolvedById && row.resolverName ? { id: row.report.resolvedById, name: row.resolverName } : null,
    createdAt: row.report.createdAt,
  });
}
