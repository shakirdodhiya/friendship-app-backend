import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, asc, count, desc, eq, ilike, isNotNull, isNull, or, SQL, sql } from 'drizzle-orm';

import { badRequest, notFound } from '../../../common/errors';
import { AppConfig } from '../../../config/app-config.service';
import { DB, type Database } from '../../../database/database.module';
import {
  blocks,
  chatParticipants,
  chats,
  coinTransactions,
  likes,
  messages,
  payments,
  postComments,
  posts,
  quickMatches,
  reports,
  subscriptions,
  userPhotos,
  users,
  verificationRequests,
  type User,
} from '../../../database/schema';
import { FirebaseService } from '../../firebase/firebase.service';
import { PresenceService } from '../../realtime/presence.service';
import { RealtimeService } from '../../realtime/realtime.service';
import { UsersService } from '../../users/users.service';
import { ageFrom, isProActive, toMeDto } from '../../users/users.mapper';
import { WalletLedgerService } from '../../wallet/wallet-ledger.service';
import { likePattern, offsetOf, pageOf } from '../common/admin-page.dto';
import { AuditService } from '../common/audit.service';
import type { AdminPrincipal } from '../common/types';
import { userRefColumns } from '../common/user-ref';
import type {
  AdminUserDetailDto,
  AdminUserPageDto,
  AdminUserRowDto,
  AdminUsersQueryDto,
  AdminUserStatsDto,
} from './dto/admin-users.dto';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class AdminUsersService {
  private readonly logger = new Logger(AdminUsersService.name);

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly config: AppConfig,
    private readonly audit: AuditService,
    private readonly ledger: WalletLedgerService,
    private readonly usersService: UsersService,
    private readonly firebase: FirebaseService,
    private readonly realtime: RealtimeService,
    private readonly presence: PresenceService,
  ) {}

  async list(query: AdminUsersQueryDto): Promise<AdminUserPageDto> {
    const where = and(...this.filters(query));
    const order: SQL[] = {
      newest: [desc(users.createdAt)],
      oldest: [asc(users.createdAt)],
      last_active: [desc(users.lastActiveAt)],
      coins: [desc(users.coinBalance)],
    }[query.sort];

    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select({ ...userRefColumns(users), user: users })
        .from(users)
        .where(where)
        .orderBy(...order, desc(users.id))
        .limit(query.pageSize)
        .offset(offsetOf(query)),
      this.db.select({ total: count() }).from(users).where(where),
    ]);

    const items = rows.map(({ user, ...ref }): AdminUserRowDto => ({
      ...ref,
      gender: user.gender,
      age: ageFrom(user.birthday),
      city: user.city,
      country: user.country,
      authProvider: user.authProvider,
      verificationStatus: user.verificationStatus,
      coins: user.coinBalance,
      isPro: isProActive(user),
      proUntil: user.proUntil,
      onboardingCompleted: user.onboardingCompletedAt !== null,
      suspendedAt: user.suspendedAt,
      deletedAt: user.deletedAt,
      lastActiveAt: user.lastActiveAt,
      createdAt: user.createdAt,
    }));
    return pageOf(items, total, query);
  }

  async get(userId: string): Promise<AdminUserDetailDto> {
    const user = await this.find(userId);
    const [photos, stats, subs, verifications, recent] = await Promise.all([
      this.db.select().from(userPhotos).where(eq(userPhotos.userId, userId)).orderBy(asc(userPhotos.position)),
      this.stats(userId),
      this.db
        .select({
          id: subscriptions.id,
          planId: subscriptions.planId,
          status: subscriptions.status,
          startsAt: subscriptions.startsAt,
          expiresAt: subscriptions.expiresAt,
          cancelledAt: subscriptions.cancelledAt,
        })
        .from(subscriptions)
        .where(eq(subscriptions.userId, userId))
        .orderBy(desc(subscriptions.createdAt)),
      this.db
        .select({
          id: verificationRequests.id,
          selfieUrl: verificationRequests.selfieUrl,
          status: verificationRequests.status,
          reviewNote: verificationRequests.reviewNote,
          reviewedAt: verificationRequests.reviewedAt,
          createdAt: verificationRequests.createdAt,
        })
        .from(verificationRequests)
        .where(eq(verificationRequests.userId, userId))
        .orderBy(desc(verificationRequests.createdAt)),
      this.db
        .select({
          id: coinTransactions.id,
          type: coinTransactions.type,
          amount: coinTransactions.amount,
          balanceAfter: coinTransactions.balanceAfter,
          metadata: coinTransactions.metadata,
          createdAt: coinTransactions.createdAt,
        })
        .from(coinTransactions)
        .where(eq(coinTransactions.userId, userId))
        .orderBy(desc(coinTransactions.createdAt))
        .limit(20),
    ]);

    return {
      ...toMeDto(user, photos, this.config.get('FREE_CHAT_CAPACITY')),
      firebaseUid: user.firebaseUid,
      suspendedAt: user.suspendedAt,
      suspensionReason: user.suspensionReason,
      deletedAt: user.deletedAt,
      lastActiveAt: user.lastActiveAt,
      online: this.presence.isOnline(user.id, user.lastActiveAt),
      stats,
      subscriptions: subs,
      verifications,
      recentTransactions: recent,
    };
  }

  async suspend(actor: AdminPrincipal, userId: string, reason: string): Promise<AdminUserDetailDto> {
    const user = await this.findLive(userId);
    await this.db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ suspendedAt: user.suspendedAt ?? new Date(), suspensionReason: reason })
        .where(eq(users.id, userId));
      // Leave the quick match queue; an active quick match simply runs out.
      await tx
        .update(quickMatches)
        .set({ status: 'cancelled', completedAt: new Date() })
        .where(and(eq(quickMatches.userAId, userId), eq(quickMatches.status, 'waiting')));
      await this.audit.record(actor, { action: 'user.suspend', targetType: 'user', targetId: userId, metadata: { reason } }, tx);
    });

    this.realtime.disconnectUser(userId);
    if (user.firebaseUid && this.firebase.hasCredentials) {
      await this.firebase
        .revokeSessions(user.firebaseUid)
        .catch((error) => this.logger.warn(`Could not revoke Firebase sessions of ${userId}: ${error}`));
    }
    return this.get(userId);
  }

  async unsuspend(actor: AdminPrincipal, userId: string): Promise<AdminUserDetailDto> {
    await this.findLive(userId);
    await this.db.transaction(async (tx) => {
      await tx.update(users).set({ suspendedAt: null, suspensionReason: null }).where(eq(users.id, userId));
      await this.audit.record(actor, { action: 'user.unsuspend', targetType: 'user', targetId: userId }, tx);
    });
    return this.get(userId);
  }

  async adjustCoins(actor: AdminPrincipal, userId: string, amount: number, reason: string): Promise<AdminUserDetailDto> {
    await this.findLive(userId);
    const balance = await this.db.transaction(async (tx) => {
      const next = await this.ledger.apply(tx, {
        userId,
        amount,
        type: 'adjustment',
        metadata: { reason, adminId: actor.id, adminEmail: actor.email },
      });
      await this.audit.record(
        actor,
        { action: 'user.coins.adjust', targetType: 'user', targetId: userId, metadata: { amount, reason, balance: next } },
        tx,
      );
      return next;
    });
    this.realtime.emitToUser(userId, 'wallet.updated', { coins: balance });
    return this.get(userId);
  }

  async setPro(actor: AdminPrincipal, userId: string, proUntil: Date | null): Promise<AdminUserDetailDto> {
    const user = await this.findLive(userId);
    if (proUntil && proUntil <= new Date()) throw badRequest('proUntil must be in the future, or null to end Pro');
    await this.db.transaction(async (tx) => {
      await tx.update(users).set({ proUntil }).where(eq(users.id, userId));
      await this.audit.record(
        actor,
        { action: 'user.pro.set', targetType: 'user', targetId: userId, metadata: { from: user.proUntil, to: proUntil } },
        tx,
      );
    });
    return this.get(userId);
  }

  async remove(actor: AdminPrincipal, userId: string): Promise<void> {
    const user = await this.findLive(userId);
    await this.usersService.deleteAccount(userId);
    this.realtime.disconnectUser(userId);
    await this.audit.record(actor, {
      action: 'user.delete',
      targetType: 'user',
      targetId: userId,
      metadata: { name: user.name, email: user.email, phone: user.phone },
    });
  }

  private filters(query: AdminUsersQueryDto): SQL[] {
    const conditions: SQL[] = [];
    if (query.status === 'deleted') conditions.push(isNotNull(users.deletedAt));
    else conditions.push(isNull(users.deletedAt));
    if (query.status === 'active') conditions.push(isNull(users.suspendedAt));
    if (query.status === 'suspended') conditions.push(isNotNull(users.suspendedAt));

    if (query.verification) conditions.push(eq(users.verificationStatus, query.verification));
    if (query.gender) conditions.push(eq(users.gender, query.gender));
    if (query.pro === true) conditions.push(sql`${users.proUntil} > now()`);
    if (query.pro === false) conditions.push(sql`(${users.proUntil} is null or ${users.proUntil} <= now())`);
    if (query.onboarded === true) conditions.push(isNotNull(users.onboardingCompletedAt));
    if (query.onboarded === false) conditions.push(isNull(users.onboardingCompletedAt));

    if (query.search) {
      const pattern = likePattern(query.search);
      const matches = [ilike(users.name, pattern), ilike(users.email, pattern), ilike(users.phone, pattern), ilike(users.city, pattern)];
      if (UUID.test(query.search)) matches.push(eq(users.id, query.search));
      conditions.push(or(...matches)!);
    }
    return conditions;
  }

  private async stats(userId: string): Promise<AdminUserStatsDto> {
    const { rows } = await this.db.execute<Omit<AdminUserStatsDto, 'spend'>>(sql`
      select
        (select count(*)::int from ${chatParticipants} cp join ${chats} c on c.id = cp.chat_id
           where cp.user_id = ${userId} and c.closed_at is null) as "openChats",
        (select count(*)::int from ${messages} where ${messages.senderId} = ${userId}) as "messagesSent",
        (select count(*)::int from ${likes} where ${likes.likerId} = ${userId}) as "likesSent",
        (select count(*)::int from ${likes} where ${likes.likeeId} = ${userId}) as "likesReceived",
        (select count(*)::int from ${blocks} where ${blocks.blockerId} = ${userId}) as "blocksMade",
        (select count(*)::int from ${blocks} where ${blocks.blockedId} = ${userId}) as "blockedBy",
        (select count(*)::int from ${reports} where ${reports.reporterId} = ${userId}) as "reportsMade",
        (select count(*)::int from ${reports} where ${reports.reportedId} = ${userId}) as "reportsReceived",
        (select count(*)::int from ${posts} where ${posts.authorId} = ${userId} and ${posts.deletedAt} is null) as "posts",
        (select count(*)::int from ${postComments} where ${postComments.authorId} = ${userId}
           and ${postComments.deletedAt} is null) as "comments",
        (select count(*)::int from ${quickMatches} where ${quickMatches.userAId} = ${userId}
           or ${quickMatches.userBId} = ${userId}) as "quickMatches"
    `);
    const spend = await this.db
      .select({ currency: payments.currency, amountCents: sql<number>`sum(${payments.amountCents})::int` })
      .from(payments)
      .where(eq(payments.userId, userId))
      .groupBy(payments.currency);
    return { ...rows[0], spend };
  }

  private async find(userId: string): Promise<User> {
    const [user] = await this.db.select().from(users).where(eq(users.id, userId));
    if (!user) throw notFound('User');
    return user;
  }

  /** A user that is not deleted, or 404. */
  private async findLive(userId: string): Promise<User> {
    const user = await this.find(userId);
    if (user.deletedAt) throw notFound('User');
    return user;
  }
}
