import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

import { AppConfig } from '../../config/app-config.service';
import { LocationsModule } from '../locations/locations.module';
import { PeopleModule } from '../people/people.module';
import { WalletModule } from '../wallet/wallet.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [
    LocationsModule,
    PeopleModule,
    WalletModule,
    MulterModule.registerAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        storage: memoryStorage(),
        limits: { fileSize: config.get('MAX_UPLOAD_MB') * 1024 * 1024, files: 1 },
      }),
    }),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}