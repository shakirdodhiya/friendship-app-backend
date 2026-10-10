import { IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';

import { paymentProviderEnum } from '../../../database/schema';
import type { PaymentProvider } from '../../../database/schema';

/** Fields every store purchase sends; the product id is added by the coin and Pro endpoints. */
export class StorePurchaseDto {
  /** `test` is only accepted when ALLOW_TEST_PAYMENTS is on. */
  @IsIn(paymentProviderEnum.enumValues)
  provider: PaymentProvider;

  /** Store transaction id (App Store) or order id (Play). Re-sending the same id is idempotent. */
  @IsString()
  @Length(1, 200)
  transactionId: string;

  /** Signed transaction / purchase token from the store SDK. */
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  receipt?: string;
}
