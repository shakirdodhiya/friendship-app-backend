import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDate, IsIn, IsInt, IsOptional, IsString, Length, Max, Min, NotEquals, ValidateIf } from 'class-validator';

import {
  coinTransactionTypeEnum,
  genderEnum,
  subscriptionStatusEnum,
  verificationStatusEnum,
  type CoinTransactionType,
  type Gender,
  type SubscriptionStatus,
  type VerificationStatus,
} from '../../../../database/schema';
import { MeDto } from '../../../users/dto/me.dto';
import { AdminPageQueryDto, AdminUserRefDto, toBool, trim } from '../../common/admin-page.dto';

export const USER_STATUSES = ['all', 'active', 'suspended', 'deleted'] as const;
export type UserStatusFilter = (typeof USER_STATUSES)[number];
export const USER_SORTS = ['newest', 'oldest', 'last_active', 'coins'] as const;
export type UserSort = (typeof USER_SORTS)[number];

export class AdminUsersQueryDto extends AdminPageQueryDto {
  /** `all` is every account that is not deleted. */
  @IsOptional()
  @IsIn(USER_STATUSES)
  status: UserStatusFilter = 'all';

  @IsOptional()
  @IsIn(verificationStatusEnum.enumValues)
  verification?: VerificationStatus;

  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  pro?: boolean;

  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  onboarded?: boolean;

  @IsOptional()
  @IsIn(genderEnum.enumValues)
  gender?: Gender;

  @IsOptional()
  @IsIn(USER_SORTS)
  sort: UserSort = 'newest';
}

export class AdminUserRowDto extends AdminUserRefDto {
  @ApiProperty({ enum: genderEnum.enumValues, nullable: true })
  gender: Gender | null;
  age: number | null;
  city: string | null;
  country: string | null;
  authProvider: string | null;
  @ApiProperty({ enum: verificationStatusEnum.enumValues })
  verificationStatus: VerificationStatus;
  coins: number;
  isPro: boolean;
  proUntil: Date | null;
  onboardingCompleted: boolean;
  suspendedAt: Date | null;
  deletedAt: Date | null;
  lastActiveAt: Date;
  createdAt: Date;
}

export class AdminUserPageDto {
  items: AdminUserRowDto[];
  total: number;
  page: number;
  pageSize: number;
}

export class AdminUserStatsDto {
  openChats: number;
  messagesSent: number;
  likesSent: number;
  likesReceived: number;
  blocksMade: number;
  blockedBy: number;
  reportsMade: number;
  reportsReceived: number;
  posts: number;
  comments: number;
  quickMatches: number;
  /** Lifetime store spend in cents, per currency. */
  spend: { currency: string; amountCents: number }[];
}

export class AdminSubscriptionSummaryDto {
  id: string;
  planId: string;
  @ApiProperty({ enum: subscriptionStatusEnum.enumValues })
  status: SubscriptionStatus;
  startsAt: Date;
  expiresAt: Date;
  cancelledAt: Date | null;
}

export class AdminVerificationSummaryDto {
  id: string;
  selfieUrl: string;
  @ApiProperty({ enum: verificationStatusEnum.enumValues })
  status: VerificationStatus;
  reviewNote: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
}

export class AdminCoinTransactionSummaryDto {
  id: string;
  @ApiProperty({ enum: coinTransactionTypeEnum.enumValues })
  type: CoinTransactionType;
  amount: number;
  balanceAfter: number;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export class AdminUserDetailDto extends MeDto {
  firebaseUid: string | null;
  suspendedAt: Date | null;
  suspensionReason: string | null;
  deletedAt: Date | null;
  lastActiveAt: Date;
  online: boolean;
  stats: AdminUserStatsDto;
  subscriptions: AdminSubscriptionSummaryDto[];
  verifications: AdminVerificationSummaryDto[];
  /** Latest 20 ledger entries; the full history is at `GET /admin/billing/transactions?userId=`. */
  recentTransactions: AdminCoinTransactionSummaryDto[];
}

export class SuspendUserDto {
  /** Shown to other admins, not to the user. */
  @Transform(trim)
  @IsString()
  @Length(3, 500)
  reason: string;
}

export class AdjustCoinsDto {
  /** Positive to credit, negative to debit. A debit can't take the balance below zero. */
  @IsInt()
  @NotEquals(0)
  @Min(-1_000_000)
  @Max(1_000_000)
  amount: number;

  @Transform(trim)
  @IsString()
  @Length(3, 500)
  reason: string;
}

export class SetProDto {
  /** When Pro ends, or `null` to end it now. */
  @ValidateIf((_, value) => value !== null)
  @Type(() => Date)
  @IsDate()
  proUntil: Date | null;
}
