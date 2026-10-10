import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import {
  coinTransactionTypeEnum,
  paymentProductTypeEnum,
  paymentProviderEnum,
  subscriptionStatusEnum,
} from './enums';
import { users } from './users';

export const coinPacks = pgTable('coin_packs', {
  /** Matches the store product id, e.g. `p500`. */
  id: text('id').primaryKey(),
  coins: integer('coins').notNull(),
  priceCents: integer('price_cents').notNull(),
  /** Struck-through original price shown on the featured pack. */
  wasPriceCents: integer('was_price_cents'),
  currency: text('currency').notNull().default('USD'),
  bonusLabel: text('bonus_label'),
  sortOrder: smallint('sort_order').notNull().default(0),
  active: boolean('active').notNull().default(true),
});

export const proPlans = pgTable('pro_plans', {
  id: text('id').primaryKey(),
  term: text('term').notNull(),
  durationMonths: smallint('duration_months').notNull(),
  priceCents: integer('price_cents').notNull(),
  wasPriceCents: integer('was_price_cents'),
  currency: text('currency').notNull().default('USD'),
  bonusCoins: integer('bonus_coins').notNull().default(0),
  badge: text('badge'),
  recommended: boolean('recommended').notNull().default(false),
  sortOrder: smallint('sort_order').notNull().default(0),
  active: boolean('active').notNull().default(true),
});

/** Append-only ledger. `amount` is signed; `balanceAfter` snapshots `users.coin_balance`. */
export const coinTransactions = pgTable(
  'coin_transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: coinTransactionTypeEnum('type').notNull(),
    amount: integer('amount').notNull(),
    balanceAfter: integer('balance_after').notNull(),
    /** Id of the thing that caused it: payment, message, quick match… */
    referenceId: text('reference_id'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('coin_transactions_user_created_idx').on(t.userId, t.createdAt),
    check('coin_transactions_amount_nonzero', sql`${t.amount} <> 0`),
  ],
);

/** Store receipts we have honoured. The unique key makes purchases idempotent. */
export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: paymentProviderEnum('provider').notNull(),
    providerTransactionId: text('provider_transaction_id').notNull(),
    productType: paymentProductTypeEnum('product_type').notNull(),
    productId: text('product_id').notNull(),
    amountCents: integer('amount_cents').notNull(),
    currency: text('currency').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('payments_provider_transaction_key').on(t.provider, t.providerTransactionId),
    index('payments_user_idx').on(t.userId),
  ],
);

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    planId: text('plan_id')
      .notNull()
      .references(() => proPlans.id),
    paymentId: uuid('payment_id').references(() => payments.id, { onDelete: 'set null' }),
    status: subscriptionStatusEnum('status').notNull().default('active'),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('subscriptions_user_idx').on(t.userId)],
);

export type CoinPack = typeof coinPacks.$inferSelect;
export type ProPlan = typeof proPlans.$inferSelect;
export type CoinTransaction = typeof coinTransactions.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
