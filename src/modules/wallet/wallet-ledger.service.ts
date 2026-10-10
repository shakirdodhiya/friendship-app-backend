import { Injectable } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';

import { insufficientCoins, notFound } from '../../common/errors';
import type { DbExecutor } from '../../database/database.module';
import { CoinTransactionType, coinTransactions, users } from '../../database/schema';

export interface CoinChange {
  userId: string;
  /** Positive to credit, negative to debit. */
  amount: number;
  type: CoinTransactionType;
  referenceId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * The only place that changes `users.coin_balance`.
 * Always call it inside the transaction that does the thing being paid for,
 * so a failed debit rolls the whole operation back.
 */
@Injectable()
export class WalletLedgerService {
  /** Applies the change and records it in the ledger. Returns the new balance. */
  async apply(tx: DbExecutor, change: CoinChange): Promise<number> {
    if (change.amount === 0) return this.balance(tx, change.userId);

    // The WHERE clause makes the debit atomic: no row comes back if it would go negative.
    const [updated] = await tx
      .update(users)
      .set({ coinBalance: sql`${users.coinBalance} + ${change.amount}` })
      .where(sql`${users.id} = ${change.userId} and ${users.coinBalance} + ${change.amount} >= 0`)
      .returning({ balance: users.coinBalance });

    if (!updated) {
      const balance = await this.balance(tx, change.userId);
      throw insufficientCoins(-change.amount, balance);
    }

    await tx.insert(coinTransactions).values({
      userId: change.userId,
      type: change.type,
      amount: change.amount,
      balanceAfter: updated.balance,
      referenceId: change.referenceId,
      metadata: change.metadata,
    });
    return updated.balance;
  }

  async balance(db: DbExecutor, userId: string): Promise<number> {
    const [row] = await db.select({ balance: users.coinBalance }).from(users).where(eq(users.id, userId));
    if (!row) throw notFound('User');
    return row.balance;
  }
}
