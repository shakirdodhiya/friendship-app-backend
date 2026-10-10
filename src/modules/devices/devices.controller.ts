import { Body, Controller, HttpCode, HttpStatus, Inject, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { and, eq } from 'drizzle-orm';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/types/auth-user';
import { DB, type Database } from '../../database/database.module';
import { devices } from '../../database/schema';
import { RegisterDeviceDto, UnregisterDeviceDto } from './dto/device.dto';

@ApiTags('Devices')
@ApiBearerAuth()
@Controller('devices')
export class DevicesController {
  constructor(@Inject(DB) private readonly db: Database) {}

  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Register this device for push notifications',
    description: 'Call after the user allows notifications and on every app start. A token moves to whoever registers it last.',
  })
  async register(@CurrentUser() user: AuthUser, @Body() dto: RegisterDeviceDto): Promise<void> {
    await this.db
      .insert(devices)
      .values({ userId: user.id, pushToken: dto.pushToken, platform: dto.platform })
      .onConflictDoUpdate({
        target: devices.pushToken,
        set: { userId: user.id, platform: dto.platform, updatedAt: new Date() },
      });
  }

  @Post('unregister')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Stop push notifications to this device (call on sign-out)' })
  async unregister(@CurrentUser() user: AuthUser, @Body() dto: UnregisterDeviceDto): Promise<void> {
    await this.db
      .delete(devices)
      .where(and(eq(devices.pushToken, dto.pushToken), eq(devices.userId, user.id)));
  }
}
