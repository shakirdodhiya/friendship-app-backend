import { Module } from '@nestjs/common';

import { PaymentsModule } from '../payments/payments.module';
import { WalletLedgerService } from './wallet-ledger.service';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';

@Module({
  imports: [PaymentsModule],
  controllers: [WalletController],
  providers: [WalletService, WalletLedgerService],
  exports: [WalletLedgerService],
})
export class WalletModule {}
