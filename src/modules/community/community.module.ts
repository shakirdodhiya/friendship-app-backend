import { Module } from '@nestjs/common';

import { PeopleModule } from '../people/people.module';
import { UsersModule } from '../users/users.module';
import { CommunityController } from './community.controller';
import { CommunityService } from './community.service';

@Module({
  imports: [UsersModule, PeopleModule],
  controllers: [CommunityController],
  providers: [CommunityService],
})
export class CommunityModule {}
