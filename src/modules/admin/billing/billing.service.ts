import { Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq, ilike, or, SQL } from 'drizzle-orm';

import { DB, type Database } from '../../../database/database.module';
import { coinTransactions, payments, proPlans, subscriptions, users } from '../../../database/schema';
import { likePattern, offsetOf, pageOf } from '../common/admin-page.dto';
import { userRefColumns } from '../common/user-ref';
import type {
  AdminCoinTransactionPageDto,
  AdminPaymentPageDto,
  AdminSubscriptionPageDto,
  PaymentsQueryDto,
  SubscriptionsQueryDto,
  TransactionsQueryDto,
} from './dto/billing.dto';

/** Read-only views of the money tables. */
@Injectable()
export class BillingService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async payments(query: PaymentsQueryDto): Promise<AdminPaymentPageDto> {
    const conditions: SQL[] = [];
    if (query.provider) conditions.push(eq(payments.provider, query.provider));
    if (query.productType) conditions.push(eq(payments.productType, query.productType));
    if (query.userId) conditions.push(eq(payments.userId, query.userId));
    if (query.search) {
      const pattern = likePattern(query.search);
      conditions.push(
        or(ilike(payments.providerTransactionId, pattern), ilike(payments.productId, pattern), ilike(users.name, pattern))!,
      );
    }
    const where = and(...conditions);

    const [items, [{ total }]] = await Promise.all([
      this.db
        .select({
          id: payments.id,
          user: userRefColumns(users),
          provider: payments.provider,
          providerTransactionId: payments.providerTransactionId,
          productType: payments.productType,
          productId: payments.productId,
          amountCents: payments.amountCents,
          currency: payments.currency,
          createdAt: payments.createdAt,
        })
        .from(payments)
        .innerJoin(users, eq(users.id, payments.userId))
        .where(where)
        .orderBy(desc(payments.createdAt))
        .limit(query.pageSize)
        .offset(offsetOf(query)),
      this.db.select({ total: count() }).from(payments).innerJoin(users, eq(users.id, payments.userId)).where(where),
    ]);
    return pageOf(items, total, query);
  }

  async subscriptions(query: SubscriptionsQueryDto): Promise<AdminSubscriptionPageDto> {
    const conditions: SQL[] = [];
    if (query.status) conditions.push(eq(subscriptions.status, query.status));
    if (query.userId) conditions.push(eq(subscriptions.userId, query.userId));
    if (query.search) conditions.push(ilike(users.name, likePattern(query.search)));
    const where = and(...conditions);

    const [items, [{ total }]] = await Promise.all([
      this.db
        .select({
          id: subscriptions.id,
          user: userRefColumns(users),
          planId: subscriptions.planId,
          planTerm: proPlans.term,
          status: subscriptions.status,
          startsAt: subscriptions.startsAt,
          expiresAt: subscriptions.expiresAt,
          cancelledAt: subscriptions.cancelledAt,
          createdAt: subscriptions.createdAt,
        })
        .from(subscriptions)
        .innerJoin(users, eq(users.id, subscriptions.userId))
        .innerJoin(proPlans, eq(proPlans.id, subscriptions.planId))
        .where(where)
        .orderBy(desc(subscriptions.createdAt))
        .limit(query.pageSize)
        .offset(offsetOf(query)),
      this.db
        .select({ total: count() })
        .from(subscriptions)
        .innerJoin(users, eq(users.id, subscriptions.userId))
        .where(where),
    ]);
    return pageOf(items, total, query);
  }

  async transactions(query: TransactionsQueryDto): Promise<AdminCoinTransactionPageDto> {
    const conditions: SQL[] = [];
    if (query.type) conditions.push(eq(coinTransactions.type, query.type));
    if (query.userId) conditions.push(eq(coinTransactions.userId, query.userId));
    if (query.search) conditions.push(ilike(users.name, likePattern(query.search)));
    const where = and(...conditions);

    const [items, [{ total }]] = await Promise.all([
      this.db
        .select({
          id: coinTransactions.id,
          user: userRefColumns(users),
          type: coinTransactions.type,
          amount: coinTransactions.amount,
          balanceAfter: coinTransactions.balanceAfter,
          referenceId: coinTransactions.referenceId,
          metadata: coinTransactions.metadata,
          createdAt: coinTransactions.createdAt,
        })
        .from(coinTransactions)
        .innerJoin(users, eq(users.id, coinTransactions.userId))
        .where(where)
        .orderBy(desc(coinTransactions.createdAt), desc(coinTransactions.id))
        .limit(query.pageSize)
        .offset(offsetOf(query)),
      this.db
        .select({ total: count() })
        .from(coinTransactions)
        .innerJoin(users, eq(users.id, coinTransactions.userId))
        .where(where),
    ]);
    return pageOf(items, total, query);
  }
}
