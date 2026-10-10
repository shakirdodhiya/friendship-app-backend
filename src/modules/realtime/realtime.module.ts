import { Global, Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { PresenceService } from './presence.service';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeService } from './realtime.service';

@Global()
@Module({
  imports: [AuthModule],
  providers: [RealtimeGateway, RealtimeService, PresenceService],
  exports: [RealtimeService, PresenceService],
})
export class RealtimeModule {}
