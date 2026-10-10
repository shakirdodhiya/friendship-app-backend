import { Injectable } from '@nestjs/common';
import type { Namespace } from 'socket.io';

import { ClientToServerEvents, ServerToClientEvents, userRoom } from './realtime.events';

/** Lets any service push an event to a user without knowing about sockets. */
@Injectable()
export class RealtimeService {
  private server?: Namespace<ClientToServerEvents, ServerToClientEvents>;

  attach(server: Namespace<ClientToServerEvents, ServerToClientEvents>) {
    this.server = server;
  }

  emitToUser<E extends keyof ServerToClientEvents>(
    userId: string,
    event: E,
    ...args: Parameters<ServerToClientEvents[E]>
  ): void {
    this.server?.to(userRoom(userId)).emit(event, ...args);
  }

  /** Closes every open socket of a user, e.g. after an admin suspends the account. */
  disconnectUser(userId: string): void {
    this.server?.in(userRoom(userId)).disconnectSockets(true);
  }
}
