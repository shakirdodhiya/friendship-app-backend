import { Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';

import { conflict } from '../../common/errors';
import type { DbExecutor } from '../../database/database.module';
import { PaymentProductType, PaymentProvider, payments } from '../../database/schema';

export interface PaymentRecord {
  userId: string;
  provider: PaymentProvider;
  transactionId: string;
  productType: PaymentProductType;
  productId: string;
  amountCents: number;
  currency: string;
}

@Injectable()
export class PaymentsService {
  /**
   * Records a verified purchase exactly once.
   * Returns `null` when this exact purchase was already honoured (a client retry), so callers skip granting it again.
   */
  async recordOnce(tx: DbExecutor, record: PaymentRecord): Promise<{ id: string } | null> {
    const [inserted] = await tx
      .insert(payments)
      .values({
        userId: record.userId,
        provider: record.provider,
        providerTransactionId: record.transactionId,
        productType: record.productType,
        productId: record.productId,
        amountCents: record.amountCents,
        currency: record.currency,
      })
      .onConflictDoNothing()
      .returning({ id: payments.id });
    if (inserted) return inserted;

    const [existing] = await tx
      .select()
      .from(payments)
      .where(and(eq(payments.provider, record.provider), eq(payments.providerTransactionId, record.transactionId)));
    if (existing && existing.userId === record.userId && existing.productId === record.productId) return null;
    throw conflict('This store transaction was already used for a different purchase');
  }
}
