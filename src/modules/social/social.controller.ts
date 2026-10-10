import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import type { AuthUser } from '../../common/types/auth-user';
import { PeoplePageDto } from '../discover/dto/discover.dto';
import { BlockedUserDto, CreateReportDto, LikeResultDto, ReportCreatedDto } from './dto/social.dto';
import { SocialService } from './social.service';

@ApiTags('Likes')
@ApiBearerAuth()
@Controller('likes')
export class LikesController {
  constructor(private readonly social: SocialService) {}

  @Get('sent')
  @ApiOperation({ summary: 'People I liked' })
  sent(@CurrentUser() user: AuthUser, @Query() query: PaginationQueryDto): Promise<PeoplePageDto> {
    return this.social.sent(user.id, query);
  }

  @Get('received')
  @ApiOperation({ summary: 'People who liked me' })
  received(@CurrentUser() user: AuthUser, @Query() query: PaginationQueryDto): Promise<PeoplePageDto> {
    return this.social.received(user.id, query);
  }

  @Post(':userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Like someone (idempotent)' })
  like(@CurrentUser() user: AuthUser, @Param('userId', ParseUUIDPipe) userId: string): Promise<LikeResultDto> {
    return this.social.like(user.id, userId);
  }

  @Delete(':userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove my like' })
  unlike(@CurrentUser() user: AuthUser, @Param('userId', ParseUUIDPipe) userId: string): Promise<void> {
    return this.social.unlike(user.id, userId);
  }
}

@ApiTags('Safety')
@ApiBearerAuth()
@Controller()
export class SafetyController {
  constructor(private readonly social: SocialService) {}

  @Get('blocks')
  @ApiOperation({ summary: 'People I blocked' })
  blocked(@CurrentUser() user: AuthUser): Promise<BlockedUserDto[]> {
    return this.social.blocked(user.id);
  }

  @Post('blocks/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Block someone', description: 'Hides you from each other and closes any chat between you.' })
  block(@CurrentUser() user: AuthUser, @Param('userId', ParseUUIDPipe) userId: string): Promise<void> {
    return this.social.block(user.id, userId);
  }

  @Delete('blocks/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unblock someone' })
  unblock(@CurrentUser() user: AuthUser, @Param('userId', ParseUUIDPipe) userId: string): Promise<void> {
    return this.social.unblock(user.id, userId);
  }

  @Post('reports')
  @ApiOperation({ summary: 'Report someone to the moderators' })
  report(@CurrentUser() user: AuthUser, @Body() dto: CreateReportDto): Promise<ReportCreatedDto> {
    return this.social.report(user.id, dto);
  }
}
