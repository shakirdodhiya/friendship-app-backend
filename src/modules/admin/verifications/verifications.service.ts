import { Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq, ilike, or, SQL, sql } from 'drizzle-orm';

import { conflict, notFound } from '../../../common/errors';
import { DB, type Database } from '../../../database/database.module';
import { adminUsers, userPhotos, users, verificationRequests } from '../../../database/schema';
import { likePattern, offsetOf, pageOf } from '../common/admin-page.dto';
import { AuditService } from '../common/audit.service';
import type { AdminPrincipal } from '../common/types';
import { userRefColumns } from '../common/user-ref';
import type {
  ReviewVerificationDto,
  VerificationPageDto,
  VerificationRequestDto,
  VerificationsQueryDto,
} from './dto/verifications.dto';

@Injectable()
export class VerificationsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly audit: AuditService,
  ) {}

  async list(query: VerificationsQueryDto): Promise<VerificationPageDto> {
    const conditions: SQL[] = [eq(verificationRequests.status, query.status)];
    if (query.search) {
      const pattern = likePattern(query.search);
      conditions.push(or(ilike(users.name, pattern), ilike(users.email, pattern), ilike(users.phone, pattern))!);
    }
    const where = and(...conditions);

    const [rows, [{ total }]] = await Promise.all([
      this.select()
        .where(where)
        // Oldest first while reviewing; newest first for the history tabs.
        .orderBy(query.status === 'pending' ? verificationRequests.createdAt : desc(verificationRequests.reviewedAt))
        .limit(query.pageSize)
        .offset(offsetOf(query)),
      this.db
        .select({ total: count() })
        .from(verificationRequests)
        .innerJoin(users, eq(users.id, verificationRequests.userId))
        .where(where),
    ]);
    return pageOf(rows.map(this.toDto), total, query);
  }

  async review(actor: AdminPrincipal, requestId: string, dto: ReviewVerificationDto): Promise<VerificationRequestDto> {
    const status = dto.decision === 'approve' ? 'verified' : 'rejected';
    await this.db.transaction(async (tx) => {
      const [request] = await tx
        .select()
        .from(verificationRequests)
        .where(eq(verificationRequests.id, requestId))
        .for('update');
      if (!request) throw notFound('Verification request');
      if (request.status !== 'pending') throw conflict('This request was already reviewed');

      await tx
        .update(verificationRequests)
        .set({ status, reviewedAt: new Date(), reviewedById: actor.id, reviewNote: dto.note || null })
        .where(eq(verificationRequests.id, requestId));
      await tx.update(users).set({ verificationStatus: status }).where(eq(users.id, request.userId));
      await this.audit.record(
        actor,
        {
          action: `verification.${dto.decision}`,
          targetType: 'verification',
          targetId: requestId,
          metadata: { userId: request.userId, note: dto.note },
        },
        tx,
      );
    });

    const [row] = await this.select().where(eq(verificationRequests.id, requestId));
    return this.toDto(row);
  }

  private select() {
    return this.db
      .select({
        request: verificationRequests,
        user: userRefColumns(users),
        photoUrls: sql<string[]>`coalesce((select array_agg(${userPhotos.url} order by ${userPhotos.position})
          from ${userPhotos} where ${userPhotos.userId} = ${users.id}), '{}')`,
        reviewerName: adminUsers.name,
      })
      .from(verificationRequests)
      .innerJoin(users, eq(users.id, verificationRequests.userId))
      .leftJoin(adminUsers, eq(adminUsers.id, verificationRequests.reviewedById))
      .$dynamic();
  }

  private toDto = (row: Awaited<ReturnType<VerificationsService['select']>>[number]): VerificationRequestDto => ({
    id: row.request.id,
    user: row.user,
    selfieUrl: row.request.selfieUrl,
    photoUrls: row.photoUrls,
    status: row.request.status,
    reviewNote: row.request.reviewNote,
    reviewedAt: row.request.reviewedAt,
    reviewedBy:
      row.request.reviewedById && row.reviewerName ? { id: row.request.reviewedById, name: row.reviewerName } : null,
    createdAt: row.request.createdAt,
  });
}
