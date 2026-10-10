import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';

import {
  coinTransactionTypeEnum,
  paymentProductTypeEnum,
  paymentProviderEnum,
  subscriptionStatusEnum,
  type CoinTransactionType,
  type PaymentProductType,
  type PaymentProvider,
  type SubscriptionStatus,
} from '../../../../database/schema';
import { AdminPageQueryDto, AdminUserRefDto } from '../../common/admin-page.dto';

export class PaymentsQueryDto extends AdminPageQueryDto {
  @IsOptional()
  @IsIn(paymentProviderEnum.enumValues)
  provider?: PaymentProvider;

  @IsOptional()
  @IsIn(paymentProductTypeEnum.enumValues)
  productType?: PaymentProductType;

  @IsOptional()
  @IsUUID()
  userId?: string;
}

export class AdminPaymentDto {
  id: string;
  user: AdminUserRefDto;
  @ApiProperty({ enum: paymentProviderEnum.enumValues })
  provider: PaymentProvider;
  providerTransactionId: string;
  @ApiProperty({ enum: paymentProductTypeEnum.enumValues })
  productType: PaymentProductType;
  productId: string;
  amountCents: number;
  currency: string;
  createdAt: Date;
}

export class AdminPaymentPageDto {
  items: AdminPaymentDto[];
  total: number;
  page: number;
  pageSize: number;
}

export class SubscriptionsQueryDto extends AdminPageQueryDto {
  @IsOptional()
  @IsIn(subscriptionStatusEnum.enumValues)
  status?: SubscriptionStatus;

  @IsOptional()
  @IsUUID()
  userId?: string;
}

export class AdminSubscriptionDto {
  id: string;
  user: AdminUserRefDto;
  planId: string;
  planTerm: string;
  @ApiProperty({ enum: subscriptionStatusEnum.enumValues })
  status: SubscriptionStatus;
  startsAt: Date;
  expiresAt: Date;
  cancelledAt: Date | null;
  createdAt: Date;
}

export class AdminSubscriptionPageDto {
  items: AdminSubscriptionDto[];
  total: number;
  page: number;
  pageSize: number;
}

export class TransactionsQueryDto extends AdminPageQueryDto {
  @IsOptional()
  @IsIn(coinTransactionTypeEnum.enumValues)
  type?: CoinTransactionType;

  @IsOptional()
  @IsUUID()
  userId?: string;
}

export class AdminCoinTransactionDto {
  id: string;
  user: AdminUserRefDto;
  @ApiProperty({ enum: coinTransactionTypeEnum.enumValues })
  type: CoinTransactionType;
  amount: number;
  balanceAfter: number;
  referenceId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export class AdminCoinTransactionPageDto {
  items: AdminCoinTransactionDto[];
  total: number;
  page: number;
  pageSize: number;
}
