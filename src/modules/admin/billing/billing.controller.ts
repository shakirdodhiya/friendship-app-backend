import { Get, Query } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';

import { AdminController, MinRole } from '../common/admin.decorators';
import { BillingService } from './billing.service';
import {
  AdminCoinTransactionPageDto,
  AdminPaymentPageDto,
  AdminSubscriptionPageDto,
  PaymentsQueryDto,
  SubscriptionsQueryDto,
  TransactionsQueryDto,
} from './dto/billing.dto';

@AdminController('billing', 'Billing')
@MinRole('admin')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('payments')
  @ApiOperation({ summary: 'Store payments', description: '`search` matches the store transaction id, product id or user name.' })
  payments(@Query() query: PaymentsQueryDto): Promise<AdminPaymentPageDto> {
    return this.billing.payments(query);
  }

  @Get('subscriptions')
  @ApiOperation({ summary: 'Pro subscriptions' })
  subscriptions(@Query() query: SubscriptionsQueryDto): Promise<AdminSubscriptionPageDto> {
    return this.billing.subscriptions(query);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Coin ledger entries' })
  transactions(@Query() query: TransactionsQueryDto): Promise<AdminCoinTransactionPageDto> {
    return this.billing.transactions(query);
  }
}
