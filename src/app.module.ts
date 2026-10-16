import { Module, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AdminModule } from './modules/admin/admin.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { ChatsModule } from './modules/chats/chats.module';
import { CommunityModule } from './modules/community/community.module';
import { DiscoverModule } from './modules/discover/discover.module';
import { FirebaseModule } from './modules/firebase/firebase.module';
import { HealthController } from './modules/health/health.controller';
import { LocationsModule } from './modules/locations/locations.module';
import { MetaController } from './modules/meta/meta.controller';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { QuickMatchModule } from './modules/quick-match/quick-match.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { SocialModule } from './modules/social/social.module';
import { StorageModule } from './modules/storage/storage.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { UsersModule } from './modules/users/users.module';
import { WalletModule } from './modules/wallet/wallet.module';

@Module({
  imports: [
    // Infrastructure
    ConfigModule,
    DatabaseModule,
    FirebaseModule,
    StorageModule,
    RealtimeModule,
    NotificationsModule,
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),

    // Features
    AuthModule,
    UsersModule,
    DiscoverModule,
    SocialModule,
    ChatsModule,
    QuickMatchModule,
    WalletModule,
    SubscriptionsModule,
    CommunityModule,
    LocationsModule,

    // Back office
    AdminModule,
  ],
  controllers: [MetaController, HealthController],
  providers: [
    // Runs before the auth guard (registered in AuthModule), so floods are cut off cheaply.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        stopAtFirstError: true,
      }),
    },
  ],
})
export class AppModule {}