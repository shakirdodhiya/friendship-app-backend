import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, gt, sql } from 'drizzle-orm';

import { notFound } from '../../common/errors';
import { DB, type Database } from '../../database/database.module';
import { proPlans, Subscription, subscriptions, users } from '../../database/schema';
import { PaymentVerifierService } from '../payments/payment-verifier.service';
import { PaymentsService } from '../payments/payments.service';
import { WalletLedgerService } from '../wallet/wallet-ledger.service';
import type {
  ProCatalogDto,
  ProStatusDto,
  SubscribeDto,
  SubscribeResultDto,
  SubscriptionDto,
} from './dto/subscription.dto';

const BENEFITS = [
  { title: 'Increased Visibility', body: 'Get seen by more people or recommended to more people' },
  { title: 'Increased Search options', body: 'Get option to search people by height, city, bio length etc.' },
  { title: 'More chat limits unlocked', body: 'Keep as many friend chats open as you like, with no upper cap.' },
  { title: 'Avatar Customization', body: 'Avatar customization options available only to Pro users help you stand out.' },
];

const addMonths = (from: Date, months: number) => {
  const d = new Date(from);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
};

const toDto = (s: Subscription): SubscriptionDto => ({
  id: s.id,
  planId: s.planId,
  status: s.status,
  startsAt: s.startsAt,
  expiresAt: s.expiresAt,
  cancelledAt: s.cancelledAt,
});

@Injectable()
export class SubscriptionsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly ledger: WalletLedgerService,
    private readonly verifier: PaymentVerifierService,
    private readonly payments: PaymentsService,
  ) {}

  async catalog(): Promise<ProCatalogDto> {
    const plans = await this.db
      .select()
      .from(proPlans)
      .where(eq(proPlans.active, true))
      .orderBy(asc(proPlans.sortOrder));
    return {
      plans: plans.map((p) => ({
        id: p.id,
        term: p.term,
        durationMonths: p.durationMonths,
        priceCents: p.priceCents,
        wasPriceCents: p.wasPriceCents,
        perMonthCents: Math.round(p.priceCents / p.durationMonths),
        currency: p.currency,
        bonusCoins: p.bonusCoins,
        badge: p.badge,
        recommended: p.recommended,
      })),
      benefits: BENEFITS,
    };
  }

  async status(userId: string): Promise<ProStatusDto> {
    const [user] = await this.db.select({ proUntil: users.proUntil }).from(users).where(eq(users.id, userId));
    if (!user) throw notFound('User');
    const [current] = await this.db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.userId, userId),
          gt(subscriptions.expiresAt, sql`now()`),
          sql`${subscriptions.startsAt} <= now()`,
        ),
      )
      .orderBy(desc(subscriptions.expiresAt))
      .limit(1);
    const isPro = !!user.proUntil && user.proUntil > new Date();
    return { isPro, proUntil: user.proUntil, current: current ? toDto(current) : null };
  }

  async history(userId: string): Promise<SubscriptionDto[]> {
    const rows = await this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .orderBy(desc(subscriptions.createdAt));
    return rows.map(toDto);
  }

  /** Buying while already Pro stacks: the new period starts when the current one ends. */
  async subscribe(userId: string, dto: SubscribeDto): Promise<SubscribeResultDto> {
    const [plan] = await this.db
      .select()
      .from(proPlans)
      .where(and(eq(proPlans.id, dto.planId), eq(proPlans.active, true)));
    if (!plan) throw notFound('Plan');

    await this.verifier.verify({
      provider: dto.provider,
      productId: plan.id,
      transactionId: dto.transactionId,
      receipt: dto.receipt,
    });

    return this.db.transaction(async (tx) => {
      const payment = await this.payments.recordOnce(tx, {
        userId,
        provider: dto.provider,
        transactionId: dto.transactionId,
        productType: 'pro_plan',
        productId: plan.id,
        amountCents: plan.priceCents,
        currency: plan.currency,
      });

      // Lock the user row so two concurrent purchases extend Pro one after the other.
      const [user] = await tx
        .select({ proUntil: users.proUntil, coins: users.coinBalance })
        .from(users)
        .where(eq(users.id, userId))
        .for('update');
      if (!user) throw notFound('User');
      if (!payment) return { activated: false, proUntil: user.proUntil, bonusCoins: 0, coins: user.coins };

      const now = new Date();
      const startsAt = user.proUntil && user.proUntil > now ? user.proUntil : now;
      const expiresAt = addMonths(startsAt, plan.durationMonths);

      await tx.insert(subscriptions).values({ userId, planId: plan.id, paymentId: payment.id, startsAt, expiresAt });
      await tx.update(users).set({ proUntil: expiresAt }).where(eq(users.id, userId));

      let coins = user.coins;
      if (plan.bonusCoins > 0) {
        coins = await this.ledger.apply(tx, {
          userId,
          amount: plan.bonusCoins,
          type: 'pro_bonus',
          referenceId: payment.id,
          metadata: { planId: plan.id },
        });
      }
      return { activated: true, proUntil: expiresAt, bonusCoins: plan.bonusCoins, coins };
    });
  }

  /**
   * Turns off renewal. Pro stays active until the paid period ends.
   * Store-billed subscriptions must also be cancelled in the store; this records the user's intent.
   */
  async cancel(userId: string): Promise<ProStatusDto> {
    await this.db
      .update(subscriptions)
      .set({ status: 'cancelled', cancelledAt: new Date() })
      .where(
        and(
          eq(subscriptions.userId, userId),
          eq(subscriptions.status, 'active'),
          gt(subscriptions.expiresAt, sql`now()`),
        ),
      );
    return this.status(userId);
  }
}
