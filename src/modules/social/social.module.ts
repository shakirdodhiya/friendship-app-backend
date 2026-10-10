import { Module } from '@nestjs/common';

import { ChatsModule } from '../chats/chats.module';
import { PeopleModule } from '../people/people.module';
import { UsersModule } from '../users/users.module';
import { LikesController, SafetyController } from './social.controller';
import { SocialService } from './social.service';

@Module({
  imports: [UsersModule, PeopleModule, ChatsModule],
  controllers: [LikesController, SafetyController],
  providers: [SocialService],
})
export class SocialModule {}
