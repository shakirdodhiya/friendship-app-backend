import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq } from 'drizzle-orm';

import { PaginationQueryDto, toPage } from '../../common/dto/pagination.dto';
import { notFound } from '../../common/errors';
import { DB, type Database } from '../../database/database.module';
import { coinPacks, coinTransactions, users } from '../../database/schema';
import { PaymentVerifierService } from '../payments/payment-verifier.service';
import { PaymentsService } from '../payments/payments.service';
import { isProActive } from '../users/users.mapper';
import type { CoinPackDto, CoinTransactionPageDto, PurchaseCoinsDto, PurchaseResultDto, WalletDto } from './dto/wallet.dto';
import { WalletLedgerService } from './wallet-ledger.service';

@Injectable()
export class WalletService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly ledger: WalletLedgerService,
    private readonly verifier: PaymentVerifierService,
    private readonly payments: PaymentsService,
  ) {}

  async wallet(userId: string): Promise<WalletDto> {
    const [user] = await this.db
      .select({ coins: users.coinBalance, proUntil: users.proUntil })
      .from(users)
      .where(eq(users.id, userId));
    if (!user) throw notFound('User');
    return { coins: user.coins, isPro: isProActive(user) };
  }

  async transactions(userId: string, query: PaginationQueryDto): Promise<CoinTransactionPageDto> {
    const rows = await this.db
      .select({
        id: coinTransactions.id,
        type: coinTransactions.type,
        amount: coinTransactions.amount,
        balanceAfter: coinTransactions.balanceAfter,
        referenceId: coinTransactions.referenceId,
        createdAt: coinTransactions.createdAt,
      })
      .from(coinTransactions)
      .where(eq(coinTransactions.userId, userId))
      .orderBy(desc(coinTransactions.createdAt), desc(coinTransactions.id))
      .limit(query.limit + 1)
      .offset(query.offset);
    return toPage(rows, query);
  }

  packs(): Promise<CoinPackDto[]> {
    return this.db
      .select({
        id: coinPacks.id,
        coins: coinPacks.coins,
        priceCents: coinPacks.priceCents,
        wasPriceCents: coinPacks.wasPriceCents,
        currency: coinPacks.currency,
        bonusLabel: coinPacks.bonusLabel,
      })
      .from(coinPacks)
      .where(eq(coinPacks.active, true))
      .orderBy(asc(coinPacks.sortOrder));
  }

  async purchase(userId: string, dto: PurchaseCoinsDto): Promise<PurchaseResultDto> {
    const [pack] = await this.db
      .select()
      .from(coinPacks)
      .where(and(eq(coinPacks.id, dto.packId), eq(coinPacks.active, true)));
    if (!pack) throw notFound('Coin pack');

    await this.verifier.verify({
      provider: dto.provider,
      productId: pack.id,
      transactionId: dto.transactionId,
      receipt: dto.receipt,
    });

    return this.db.transaction(async (tx) => {
      const payment = await this.payments.recordOnce(tx, {
        userId,
        provider: dto.provider,
        transactionId: dto.transactionId,
        productType: 'coin_pack',
        productId: pack.id,
        amountCents: pack.priceCents,
        currency: pack.currency,
      });
      if (!payment) {
        return { credited: false, coinsAdded: 0, coins: await this.ledger.balance(tx, userId) };
      }
      const coins = await this.ledger.apply(tx, {
        userId,
        amount: pack.coins,
        type: 'purchase',
        referenceId: payment.id,
        metadata: { packId: pack.id },
      });
      return { credited: true, coinsAdded: pack.coins, coins };
    });
  }
}
