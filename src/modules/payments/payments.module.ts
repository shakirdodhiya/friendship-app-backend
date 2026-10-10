import { Module } from '@nestjs/common';

import { PaymentVerifierService } from './payment-verifier.service';
import { PaymentsService } from './payments.service';

@Module({
  providers: [PaymentVerifierService, PaymentsService],
  exports: [PaymentVerifierService, PaymentsService],
})
export class PaymentsModule {}
