import { Controller, HttpCode, HttpStatus, Post, Req, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import type { AuthUser } from '../../common/types/auth-user';
import { FirebaseService } from '../firebase/firebase.service';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { SessionDto } from './dto/auth.dto';
import { extractBearer } from './firebase-auth.guard';

@ApiTags('Auth')
@ApiBearerAuth()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly firebase: FirebaseService,
    private readonly users: UsersService,
  ) {}

  /** Handled here rather than by the guard so the response can say whether the account was just created. */
  @Public()
  @Post('session')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sign in with a Firebase ID token',
    description:
      'Call right after Firebase sign-in (phone OTP, Google or Apple) with `Authorization: Bearer <idToken>`. ' +
      'Creates the account on first sign-in (with the signup coin bonus) and returns the profile.',
  })
  async session(@Req() request: Request): Promise<SessionDto> {
    const token = extractBearer(request.headers.authorization);
    if (!token) throw new UnauthorizedException('Missing bearer token');
    const decoded = await this.firebase.verifyIdToken(token).catch(() => {
      throw new UnauthorizedException('Invalid or expired Firebase ID token');
    });
    const resolved = await this.auth.resolve(decoded);
    return { isNewUser: resolved.isNewUser, user: await this.users.getMe(resolved.id) };
  }

  @Post('sign-out-everywhere')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Sign out of every device',
    description: 'Revokes all Firebase refresh tokens. Needs a service account on the server.',
  })
  signOutEverywhere(@CurrentUser() user: AuthUser): Promise<void> {
    return this.firebase.revokeSessions(user.firebaseUid);
  }
}
