import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

import { subscriptionStatusEnum } from '../../../database/schema';
import type { SubscriptionStatus } from '../../../database/schema';
import { StorePurchaseDto } from '../../payments/dto/purchase.dto';

export class ProPlanDto {
  /** Store product id, e.g. `year`. */
  id: string;
  /** e.g. "1 Year". */
  term: string;
  durationMonths: number;
  priceCents: number;
  wasPriceCents: number | null;
  /** Price divided by months, for the "USD $4.5/Month" line. */
  perMonthCents: number;
  currency: string;
  /** Coins granted when the plan is bought. */
  bonusCoins: number;
  /** e.g. "Save 53% + 200 coins bonus". */
  badge: string | null;
  recommended: boolean;
}

export class ProBenefitDto {
  title: string;
  body: string;
}

export class ProCatalogDto {
  plans: ProPlanDto[];
  benefits: ProBenefitDto[];
}

export class SubscriptionDto {
  id: string;
  planId: string;
  @ApiProperty({ enum: subscriptionStatusEnum.enumValues })
  status: SubscriptionStatus;
  startsAt: Date;
  expiresAt: Date;
  cancelledAt: Date | null;
}

export class ProStatusDto {
  isPro: boolean;
  proUntil: Date | null;
  /** The subscription currently granting Pro, if any. */
  current: SubscriptionDto | null;
}

export class SubscribeDto extends StorePurchaseDto {
  /** Plan id from `GET /subscriptions/plans`. */
  @IsString()
  @Length(1, 50)
  planId: string;
}

export class SubscribeResultDto {
  /** False when this transaction had already been redeemed (safe retry). */
  activated: boolean;
  proUntil: Date | null;
  bonusCoins: number;
  coins: number;
}
