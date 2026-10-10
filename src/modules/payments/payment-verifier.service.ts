import { HttpStatus, Injectable } from '@nestjs/common';

import { AppException, ErrorCode } from '../../common/errors';
import { AppConfig } from '../../config/app-config.service';
import type { PaymentProvider } from '../../database/schema';

export interface PurchaseClaim {
  provider: PaymentProvider;
  productId: string;
  transactionId: string;
  /** Store receipt / purchase token as sent by the device. */
  receipt?: string;
}

/**
 * Confirms that a purchase really happened before coins or Pro are granted.
 *
 * Only the `test` provider is implemented. Wire `app_store` to the App Store Server API
 * and `play_store` to the Google Play Developer API (purchases.products / subscriptionsv2) before launch.
 */
@Injectable()
export class PaymentVerifierService {
  constructor(private readonly config: AppConfig) {}

  async verify(claim: PurchaseClaim): Promise<void> {
    switch (claim.provider) {
      case 'test':
        if (!this.config.get('ALLOW_TEST_PAYMENTS')) {
          throw this.unavailable('Test payments are disabled');
        }
        return;
      case 'app_store':
      case 'play_store':
        throw this.unavailable(`Receipt validation for ${claim.provider} is not configured yet`);
    }
  }

  private unavailable(message: string) {
    return new AppException(HttpStatus.SERVICE_UNAVAILABLE, ErrorCode.PAYMENT_PROVIDER_UNAVAILABLE, message);
  }
}
