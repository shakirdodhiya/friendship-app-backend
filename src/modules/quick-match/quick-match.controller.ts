import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/types/auth-user';
import { CurrentQuickMatchDto, QuickMatchDecisionDto, QuickMatchDto } from './dto/quick-match.dto';
import { QuickMatchService } from './quick-match.service';

@ApiTags('Quick match')
@ApiBearerAuth()
@Controller('quick-match')
export class QuickMatchController {
  constructor(private readonly quickMatch: QuickMatchService) {}

  @Get('current')
  @ApiOperation({ summary: 'My waiting / active quick match, plus the price and duration' })
  current(@CurrentUser() user: AuthUser): Promise<CurrentQuickMatchDto> {
    return this.quickMatch.current(user.id);
  }

  @Post()
  @ApiOperation({
    summary: 'Join a quick match',
    description:
      'Charges QUICK_MATCH_COST coins (402 INSUFFICIENT_COINS). Pairs you immediately if someone is waiting, ' +
      'otherwise you wait and receive `quickMatch.updated` on the socket when paired.',
  })
  join(@CurrentUser() user: AuthUser): Promise<QuickMatchDto> {
    return this.quickMatch.join(user.id);
  }

  @Get(':matchId')
  @ApiOperation({ summary: 'One quick match (e.g. to read its result)' })
  get(@CurrentUser() user: AuthUser, @Param('matchId', ParseUUIDPipe) matchId: string): Promise<QuickMatchDto> {
    return this.quickMatch.get(user.id, matchId);
  }

  @Post(':matchId/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Leave the queue before being paired (coins are refunded)' })
  cancel(@CurrentUser() user: AuthUser, @Param('matchId', ParseUUIDPipe) matchId: string): Promise<QuickMatchDto> {
    return this.quickMatch.cancel(user.id, matchId);
  }

  @Post(':matchId/decision')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '"Keep as friend" or "No thanks" after the timer ends',
    description: 'When both keep, the quick chat becomes a permanent friend chat (`friendChatId`).',
  })
  decide(
    @CurrentUser() user: AuthUser,
    @Param('matchId', ParseUUIDPipe) matchId: string,
    @Body() dto: QuickMatchDecisionDto,
  ): Promise<QuickMatchDto> {
    return this.quickMatch.decide(user.id, matchId, dto.decision);
  }
}
