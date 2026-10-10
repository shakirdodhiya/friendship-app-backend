import { Body, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import type { AdminDto } from '../admins/dto/admins.dto';
import { AdminController, AdminPublic, CurrentAdmin } from '../common/admin.decorators';
import type { AdminPrincipal } from '../common/types';
import { AdminAuthService } from './admin-auth.service';
import { AdminLoginDto, AdminSessionDto, ChangePasswordDto } from './dto/admin-auth.dto';

@AdminController('auth', 'Auth')
export class AdminAuthController {
  constructor(private readonly auth: AdminAuthService) {}

  @Post('login')
  @AdminPublic()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Sign in to the admin portal', description: 'Returns a bearer token for the `/admin` routes.' })
  login(@Body() dto: AdminLoginDto): Promise<AdminSessionDto> {
    return this.auth.login(dto.email, dto.password);
  }

  @Get('me')
  @ApiOperation({ summary: 'The signed-in admin' })
  me(@CurrentAdmin() admin: AdminPrincipal): Promise<AdminDto> {
    return this.auth.me(admin.id);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Change my password', description: 'Signs out other sessions and returns a fresh token.' })
  changePassword(@CurrentAdmin() admin: AdminPrincipal, @Body() dto: ChangePasswordDto): Promise<AdminSessionDto> {
    return this.auth.changePassword(admin.id, dto.currentPassword, dto.newPassword);
  }

  @Post('sign-out-everywhere')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Invalidate all of my admin sessions' })
  signOutEverywhere(@CurrentAdmin() admin: AdminPrincipal): Promise<void> {
    return this.auth.signOutEverywhere(admin.id);
  }
}
