import { Inject, Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { eq, sql } from 'drizzle-orm';
import type { Namespace, Socket } from 'socket.io';

import type { AuthUser } from '../../common/types/auth-user';
import { DB, type Database } from '../../database/database.module';
import { chatParticipants, users } from '../../database/schema';
import { extractBearer, FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { PresenceService } from './presence.service';
import { ClientToServerEvents, ServerToClientEvents, userRoom } from './realtime.events';
import { RealtimeService } from './realtime.service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, { user?: AuthUser }>;

/**
 * Connect with `io('<host>/realtime', { auth: { token: <Firebase ID token> } })`.
 * Sending messages goes through REST; this channel only pushes events (plus typing indicators).
 */
@WebSocketGateway({ namespace: '/realtime', cors: { origin: true } })
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly guard: FirebaseAuthGuard,
    private readonly presence: PresenceService,
    private readonly realtime: RealtimeService,
    @Inject(DB) private readonly db: Database,
  ) {}

  afterInit(server: Namespace<ClientToServerEvents, ServerToClientEvents>) {
    this.realtime.attach(server);
  }

  async handleConnection(client: AppSocket) {
    const token =
      (typeof client.handshake.auth?.token === 'string' ? client.handshake.auth.token : undefined) ??
      extractBearer(client.handshake.headers.authorization);
    try {
      if (!token) throw new Error('missing token');
      const user = await this.guard.authenticate(token);
      client.data.user = user;
      await client.join(userRoom(user.id));
      this.presence.connected(user.id);
    } catch {
      // The client sees a disconnect with reason "io server disconnect": refresh the ID token and reconnect.
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: AppSocket) {
    const user = client.data.user;
    if (!user) return;
    if (this.presence.disconnected(user.id)) {
      await this.db
        .update(users)
        .set({ lastActiveAt: sql`now()` })
        .where(eq(users.id, user.id))
        .catch((error) => this.logger.warn(`Failed to update presence: ${error}`));
    }
  }

  @SubscribeMessage('typing')
  async typing(@ConnectedSocket() client: AppSocket, @MessageBody() body: { chatId?: unknown }) {
    const user = client.data.user;
    const chatId = body?.chatId;
    if (!user || typeof chatId !== 'string' || !UUID.test(chatId)) return;

    const members = await this.db
      .select({ userId: chatParticipants.userId })
      .from(chatParticipants)
      .where(eq(chatParticipants.chatId, chatId));
    if (!members.some((m) => m.userId === user.id)) return;

    for (const member of members) {
      if (member.userId !== user.id) {
        this.realtime.emitToUser(member.userId, 'chat.typing', { chatId, userId: user.id });
      }
    }
  }
}
