import { Module } from '@nestjs/common';

import { ChatsModule } from '../chats/chats.module';
import { PeopleModule } from '../people/people.module';
import { UsersModule } from '../users/users.module';
import { WalletModule } from '../wallet/wallet.module';
import { QuickMatchController } from './quick-match.controller';
import { QuickMatchService } from './quick-match.service';

@Module({
  imports: [ChatsModule, PeopleModule, UsersModule, WalletModule],
  controllers: [QuickMatchController],
  providers: [QuickMatchService],
})
export class QuickMatchModule {}
