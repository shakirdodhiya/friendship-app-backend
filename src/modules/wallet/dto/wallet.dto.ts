import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

import { PageInfoDto } from '../../../common/dto/pagination.dto';
import { coinTransactionTypeEnum } from '../../../database/schema';
import type { CoinTransactionType } from '../../../database/schema';
import { StorePurchaseDto } from '../../payments/dto/purchase.dto';

export class WalletDto {
  coins: number;
  isPro: boolean;
}

export class CoinPackDto {
  /** Store product id, e.g. `p500`. */
  id: string;
  coins: number;
  priceCents: number;
  /** Struck-through original price, if the pack is discounted. */
  wasPriceCents: number | null;
  currency: string;
  /** e.g. "Best value". */
  bonusLabel: string | null;
}

export class CoinTransactionDto {
  id: string;
  @ApiProperty({ enum: coinTransactionTypeEnum.enumValues })
  type: CoinTransactionType;
  /** Positive for credits, negative for debits. */
  amount: number;
  balanceAfter: number;
  referenceId: string | null;
  createdAt: Date;
}

export class CoinTransactionPageDto {
  items: CoinTransactionDto[];
  page: PageInfoDto;
}

export class PurchaseCoinsDto extends StorePurchaseDto {
  /** Coin pack id from `GET /wallet/packs`. */
  @IsString()
  @Length(1, 50)
  packId: string;
}

export class PurchaseResultDto {
  /** False when this transaction had already been credited (safe retry). */
  credited: boolean;
  coinsAdded: number;
  coins: number;
}
