import { Body, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';

import { AdminController, CurrentAdmin, MinRole } from '../common/admin.decorators';
import type { AdminPrincipal } from '../common/types';
import { AdminUsersService } from './admin-users.service';
import {
  AdjustCoinsDto,
  AdminUserDetailDto,
  AdminUserPageDto,
  AdminUsersQueryDto,
  SetProDto,
  SuspendUserDto,
} from './dto/admin-users.dto';

@AdminController('users', 'Users')
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Get()
  @ApiOperation({ summary: 'Search and filter app users', description: '`search` matches name, email, phone, city or id.' })
  list(@Query() query: AdminUsersQueryDto): Promise<AdminUserPageDto> {
    return this.users.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Full profile, activity counts, subscriptions and latest coin activity' })
  get(@Param('id', ParseUUIDPipe) id: string): Promise<AdminUserDetailDto> {
    return this.users.get(id);
  }

  @Post(':id/suspend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Suspend a user',
    description: 'They are signed out, hidden from other people and every request fails with `ACCOUNT_SUSPENDED`.',
  })
  suspend(
    @CurrentAdmin() admin: AdminPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SuspendUserDto,
  ): Promise<AdminUserDetailDto> {
    return this.users.suspend(admin, id, dto.reason);
  }

  @Post(':id/unsuspend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lift a suspension' })
  unsuspend(@CurrentAdmin() admin: AdminPrincipal, @Param('id', ParseUUIDPipe) id: string): Promise<AdminUserDetailDto> {
    return this.users.unsuspend(admin, id);
  }

  @Post(':id/coins')
  @HttpCode(HttpStatus.OK)
  @MinRole('admin')
  @ApiOperation({ summary: 'Credit or debit coins', description: 'Recorded in the ledger as an `adjustment`.' })
  adjustCoins(
    @CurrentAdmin() admin: AdminPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdjustCoinsDto,
  ): Promise<AdminUserDetailDto> {
    return this.users.adjustCoins(admin, id, dto.amount, dto.reason);
  }

  @Put(':id/pro')
  @MinRole('admin')
  @ApiOperation({ summary: 'Grant, extend or end Pro', description: 'Sets `proUntil` directly; no payment is recorded.' })
  setPro(
    @CurrentAdmin() admin: AdminPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetProDto,
  ): Promise<AdminUserDetailDto> {
    return this.users.setPro(admin, id, dto.proUntil);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @MinRole('admin')
  @ApiOperation({
    summary: 'Delete a user account',
    description: 'Same as the user deleting it themselves: personal data is wiped and chats are closed.',
  })
  remove(@CurrentAdmin() admin: AdminPrincipal, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.users.remove(admin, id);
  }
}
