import { OmitType, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Length, Matches, Max, Min, ValidateIf } from 'class-validator';

import { trim } from '../../common/admin-page.dto';

const ID = /^[a-z0-9_-]+$/;
/** Lets a nullable field be sent as `null` to clear it. */
const NullableOptional = () => ValidateIf((_, value) => value !== undefined && value !== null);

export class CoinPackDto {
  /** The store product id, e.g. `p500`. */
  id: string;
  coins: number;
  priceCents: number;
  wasPriceCents: number | null;
  currency: string;
  bonusLabel: string | null;
  sortOrder: number;
  active: boolean;
  /** Purchases of this pack so far. */
  purchases: number;
}

export class CreateCoinPackDto {
  /** Must match the App Store / Play product id. Lowercase letters, digits, `-` and `_`. */
  @Matches(ID)
  @Length(1, 64)
  id: string;

  @IsInt()
  @Min(1)
  @Max(1_000_000)
  coins: number;

  @IsInt()
  @Min(0)
  priceCents: number;

  @NullableOptional()
  @IsInt()
  @Min(0)
  wasPriceCents?: number | null;

  /** ISO 4217, e.g. `USD`. */
  @IsOptional()
  @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @NullableOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 40)
  bonusLabel?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateCoinPackDto extends PartialType(OmitType(CreateCoinPackDto, ['id'] as const)) {}

export class ProPlanDto {
  id: string;
  /** Label, e.g. `1 Year`. */
  term: string;
  durationMonths: number;
  priceCents: number;
  wasPriceCents: number | null;
  currency: string;
  bonusCoins: number;
  badge: string | null;
  recommended: boolean;
  sortOrder: number;
  active: boolean;
  /** Subscriptions to this plan that are active right now. */
  activeSubscriptions: number;
}

export class CreateProPlanDto {
  @Matches(ID)
  @Length(1, 64)
  id: string;

  @Transform(trim)
  @IsString()
  @Length(1, 40)
  term: string;

  @IsInt()
  @Min(1)
  @Max(120)
  durationMonths: number;

  @IsInt()
  @Min(0)
  priceCents: number;

  @NullableOptional()
  @IsInt()
  @Min(0)
  wasPriceCents?: number | null;

  @IsOptional()
  @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  bonusCoins?: number;

  @NullableOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 60)
  badge?: string | null;

  @IsOptional()
  @IsBoolean()
  recommended?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateProPlanDto extends PartialType(OmitType(CreateProPlanDto, ['id'] as const)) {}
