import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import type { AuthUser } from '../../common/types/auth-user';
import {
  CoinPackDto,
  CoinTransactionPageDto,
  PurchaseCoinsDto,
  PurchaseResultDto,
  WalletDto,
} from './dto/wallet.dto';
import { WalletService } from './wallet.service';

@ApiTags('Wallet')
@ApiBearerAuth()
@Controller('wallet')
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  @Get()
  @ApiOperation({ summary: 'My coin balance' })
  get(@CurrentUser() user: AuthUser): Promise<WalletDto> {
    return this.wallet.wallet(user.id);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'My coin history, newest first' })
  transactions(@CurrentUser() user: AuthUser, @Query() query: PaginationQueryDto): Promise<CoinTransactionPageDto> {
    return this.wallet.transactions(user.id, query);
  }

  @Get('packs')
  @ApiOperation({ summary: 'Coin packs for sale' })
  packs(): Promise<CoinPackDto[]> {
    return this.wallet.packs();
  }

  @Post('purchases')
  @ApiOperation({
    summary: 'Redeem a coin pack purchase',
    description: 'Call after the store purchase succeeds. Idempotent per store transaction id.',
  })
  purchase(@CurrentUser() user: AuthUser, @Body() dto: PurchaseCoinsDto): Promise<PurchaseResultDto> {
    return this.wallet.purchase(user.id, dto);
  }
}
