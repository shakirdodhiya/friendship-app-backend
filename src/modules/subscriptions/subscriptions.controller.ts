import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/types/auth-user';
import {
  ProCatalogDto,
  ProStatusDto,
  SubscribeDto,
  SubscribeResultDto,
  SubscriptionDto,
} from './dto/subscription.dto';
import { SubscriptionsService } from './subscriptions.service';

@ApiTags('Pro subscriptions')
@ApiBearerAuth()
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get('plans')
  @ApiOperation({ summary: 'Pro plans and benefits for the paywall' })
  plans(): Promise<ProCatalogDto> {
    return this.subscriptions.catalog();
  }

  @Get('me')
  @ApiOperation({ summary: 'My Pro status' })
  status(@CurrentUser() user: AuthUser): Promise<ProStatusDto> {
    return this.subscriptions.status(user.id);
  }

  @Get('me/history')
  @ApiOperation({ summary: 'All my subscriptions, newest first' })
  history(@CurrentUser() user: AuthUser): Promise<SubscriptionDto[]> {
    return this.subscriptions.history(user.id);
  }

  @Post()
  @ApiOperation({
    summary: 'Activate Pro after a store purchase',
    description: 'Grants the plan bonus coins. Idempotent per store transaction id.',
  })
  subscribe(@CurrentUser() user: AuthUser, @Body() dto: SubscribeDto): Promise<SubscribeResultDto> {
    return this.subscriptions.subscribe(user.id, dto);
  }

  @Post('me/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel renewal (Pro stays until the paid period ends)' })
  cancel(@CurrentUser() user: AuthUser): Promise<ProStatusDto> {
    return this.subscriptions.cancel(user.id);
  }
}
