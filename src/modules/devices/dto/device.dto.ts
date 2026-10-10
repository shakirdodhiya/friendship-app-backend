import { IsIn, IsString, Length } from 'class-validator';

import { devicePlatformEnum } from '../../../database/schema';
import type { DevicePlatform } from '../../../database/schema';

export class RegisterDeviceDto {
  /** Expo push token from `getExpoPushTokenAsync()`, e.g. `ExponentPushToken[xxxx]`. */
  @IsString()
  @Length(10, 300)
  pushToken: string;

  @IsIn(devicePlatformEnum.enumValues)
  platform: DevicePlatform;
}

export class UnregisterDeviceDto {
  @IsString()
  @Length(10, 300)
  pushToken: string;
}
