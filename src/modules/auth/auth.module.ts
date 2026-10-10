import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { UsersModule } from '../users/users.module';
import { WalletModule } from '../wallet/wallet.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { FirebaseAuthGuard } from './firebase-auth.guard';

@Module({
  imports: [UsersModule, WalletModule],
  controllers: [AuthController],
  providers: [AuthService, FirebaseAuthGuard, { provide: APP_GUARD, useExisting: FirebaseAuthGuard }],
  exports: [FirebaseAuthGuard],
})
export class AuthModule {}
