import { Module } from '@nestjs/common';

import { PeopleModule } from '../people/people.module';
import { UsersModule } from '../users/users.module';
import { DiscoverController } from './discover.controller';
import { DiscoverService } from './discover.service';

@Module({
  imports: [UsersModule, PeopleModule],
  controllers: [DiscoverController],
  providers: [DiscoverService],
})
export class DiscoverModule {}
