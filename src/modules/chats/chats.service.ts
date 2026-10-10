import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq, inArray, isNull, ne, or, SQL, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import { AppException, ErrorCode, forbidden, notFound } from '../../common/errors';
import { pairKey } from '../../common/utils/pair-key';
import { AppConfig } from '../../config/app-config.service';
import { DB, type Database, type DbExecutor } from '../../database/database.module';
import { blocks, Chat, chatParticipants, chats, Message, messages } from '../../database/schema';
import { PushService } from '../notifications/push.service';
import { PeopleService } from '../people/people.service';
import { RealtimeService } from '../realtime/realtime.service';
import { isProActive } from '../users/users.mapper';
import { UsersService } from '../users/users.service';
import { WalletLedgerService } from '../wallet/wallet-ledger.service';
import type {
  ChatCapacityDto,
  ChatDto,
  ChatListDto,
  GiftResultDto,
  MessageDto,
  MessagePageDto,
  MessagesQueryDto,
  MessageStatus,
} from './dto/chat.dto';

/** How far the other participant has got, used to derive the status of my messages. */
interface PeerProgress {
  lastReadAt: Date;
  lastDeliveredAt: Date;
}

interface Membership {
  chat: Chat;
  peerId: string;
  peer: PeerProgress;
}

const me = alias(chatParticipants, 'me');
const peer = alias(chatParticipants, 'peer');

@Injectable()
export class ChatsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly config: AppConfig,
    private readonly users: UsersService,
    private readonly people: PeopleService,
    private readonly ledger: WalletLedgerService,
    private readonly realtime: RealtimeService,
    private readonly push: PushService,
  ) {}

  // ---------------------------------------------------------------- reading

  async list(userId: string): Promise<ChatListDto> {
    const [items, capacity] = await Promise.all([
      this.loadChats(userId, isNull(chats.closedAt)),
      this.capacity(userId),
    ]);
    await this.markDelivered(userId, items.map((c) => c.id));
    return { capacity, items };
  }

  async get(userId: string, chatId: string): Promise<ChatDto> {
    const [chat] = await this.loadChats(userId, eq(chats.id, chatId));
    if (!chat) throw notFound('Chat');
    return chat;
  }

  async capacity(userId: string): Promise<ChatCapacityDto> {
    const user = await this.users.findActive(userId);
    const [row] = await this.db
      .select({ used: count() })
      .from(chatParticipants)
      .innerJoin(chats, eq(chats.id, chatParticipants.chatId))
      .where(and(eq(chatParticipants.userId, userId), eq(chats.kind, 'friend'), isNull(chats.closedAt)));
    return { used: row.used, limit: isProActive(user) ? null : this.config.get('FREE_CHAT_CAPACITY') };
  }

  async messages(userId: string, chatId: string, query: MessagesQueryDto): Promise<MessagePageDto> {
    const { peer: progress } = await this.membership(userId, chatId);

    const conditions: SQL[] = [eq(messages.chatId, chatId)];
    if (query.before) {
      const [anchor] = await this.db
        .select({ createdAt: messages.createdAt, id: messages.id })
        .from(messages)
        .where(and(eq(messages.id, query.before), eq(messages.chatId, chatId)));
      if (!anchor) throw notFound('Message');
      // Row comparison keeps paging stable when two messages share a timestamp.
      conditions.push(sql`(${messages.createdAt}, ${messages.id}) < (${anchor.createdAt}, ${anchor.id})`);
    }

    const rows = await this.db
      .select()
      .from(messages)
      .where(and(...conditions))
      .orderBy(desc(messages.createdAt), desc(messages.id))
      .limit(query.limit + 1);

    const hasMore = rows.length > query.limit;
    const page = rows.slice(0, query.limit).reverse();
    await this.markDelivered(userId, [chatId]);
    return {
      items: page.map((m) => toMessageDto(m, userId, progress)),
      nextBefore: hasMore && page.length > 0 ? page[0].id : null,
    };
  }

  // ---------------------------------------------------------------- writing

  /** Returns the open friend chat with this person, creating it if needed (subject to the free chat limit). */
  async openWith(userId: string, peerId: string): Promise<ChatDto> {
    const viewer = await this.users.assertOnboarded(userId);
    await this.people.getById(viewer, peerId); // 404 if blocked, deleted or not discoverable

    const key = pairKey(userId, peerId);
    const existing = await this.findOpenFriendChat(this.db, key);
    if (existing) return this.get(userId, existing.id);

    const capacity = await this.capacity(userId);
    if (capacity.limit !== null && capacity.used >= capacity.limit) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        ErrorCode.CHAT_CAPACITY_REACHED,
        `Free accounts can have ${capacity.limit} chats open at once. Upgrade to Pro for unlimited chats.`,
        capacity,
      );
    }

    const chatId = await this.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(chats)
        .values({ kind: 'friend', pairKey: key, createdById: userId })
        .onConflictDoNothing()
        .returning({ id: chats.id });
      if (!created) {
        // The other person opened it at the same moment.
        const raced = await this.findOpenFriendChat(tx, key);
        if (!raced) throw new Error('Chat insert conflicted but no open chat exists');
        return raced.id;
      }
      await tx.insert(chatParticipants).values([
        { chatId: created.id, userId },
        { chatId: created.id, userId: peerId },
      ]);
      return created.id;
    });
    return this.get(userId, chatId);
  }

  async sendText(userId: string, chatId: string, text: string): Promise<MessageDto> {
    const membership = await this.assertCanSend(userId, chatId);
    const message = await this.db.transaction(async (tx) => {
      const [row] = await tx.insert(messages).values({ chatId, senderId: userId, kind: 'text', body: text }).returning();
      await this.afterInsert(tx, chatId, userId, row.createdAt);
      return row;
    });
    await this.broadcast(membership, userId, message);
    return toMessageDto(message, userId, membership.peer);
  }

  /** Moves coins from me to the other participant and posts a gift message — atomically. */
  async sendGift(userId: string, chatId: string, coins: number): Promise<GiftResultDto> {
    const membership = await this.assertCanSend(userId, chatId);
    const { message, senderBalance, recipientBalance } = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(messages)
        .values({ chatId, senderId: userId, kind: 'gift', body: `Gifted ${coins} coins`, coins })
        .returning();
      const senderBalance = await this.ledger.apply(tx, {
        userId,
        amount: -coins,
        type: 'gift_sent',
        referenceId: row.id,
        metadata: { to: membership.peerId, chatId },
      });
      const recipientBalance = await this.ledger.apply(tx, {
        userId: membership.peerId,
        amount: coins,
        type: 'gift_received',
        referenceId: row.id,
        metadata: { from: userId, chatId },
      });
      await this.afterInsert(tx, chatId, userId, row.createdAt);
      return { message: row, senderBalance, recipientBalance };
    });

    this.realtime.emitToUser(userId, 'wallet.updated', { coins: senderBalance });
    this.realtime.emitToUser(membership.peerId, 'wallet.updated', { coins: recipientBalance });
    await this.broadcast(membership, userId, message);
    return { message: toMessageDto(message, userId, membership.peer), coins: senderBalance };
  }

  async markRead(userId: string, chatId: string): Promise<void> {
    const { peerId } = await this.membership(userId, chatId);
    const now = new Date();
    await this.db
      .update(chatParticipants)
      .set({ lastReadAt: now, lastDeliveredAt: now })
      .where(and(eq(chatParticipants.chatId, chatId), eq(chatParticipants.userId, userId)));
    this.realtime.emitToUser(peerId, 'chat.read', { chatId, userId, readAt: now.toISOString() });
  }

  /** Closes the chat for both people. Frees a slot towards the free chat limit. */
  async leave(userId: string, chatId: string): Promise<void> {
    const { peerId } = await this.membership(userId, chatId);
    await this.close(this.db, chatId);
    for (const id of [userId, peerId]) this.realtime.emitToUser(id, 'chat.closed', { chatId });
  }

  // ---------------------------------------------------------------- used by quick match

  async createQuickChat(tx: DbExecutor, userA: string, userB: string, expiresAt: Date): Promise<string> {
    const [chat] = await tx
      .insert(chats)
      .values({ kind: 'quick', pairKey: pairKey(userA, userB), expiresAt })
      .returning({ id: chats.id });
    await tx.insert(chatParticipants).values([
      { chatId: chat.id, userId: userA },
      { chatId: chat.id, userId: userB },
    ]);
    return chat.id;
  }

  /**
   * Both kept the quick match: the quick chat becomes a permanent friend chat, history included.
   * If they already had a friend chat, that one is kept and the quick chat is closed.
   */
  async promoteQuickChat(tx: DbExecutor, chatId: string, userA: string, userB: string): Promise<string> {
    const existing = await this.findOpenFriendChat(tx, pairKey(userA, userB));
    if (existing) {
      await this.close(tx, chatId);
      return existing.id;
    }
    await tx.update(chats).set({ kind: 'friend', expiresAt: null }).where(eq(chats.id, chatId));
    return chatId;
  }

  async close(db: DbExecutor, chatId: string): Promise<void> {
    await db.update(chats).set({ closedAt: new Date() }).where(and(eq(chats.id, chatId), isNull(chats.closedAt)));
  }

  /** Closes every open chat (friend or quick) between two people. Returns the closed chat ids. */
  async closeAllBetween(db: DbExecutor, userA: string, userB: string): Promise<string[]> {
    const closed = await db
      .update(chats)
      .set({ closedAt: new Date() })
      .where(and(eq(chats.pairKey, pairKey(userA, userB)), isNull(chats.closedAt)))
      .returning({ id: chats.id });
    return closed.map((c) => c.id);
  }

  // ---------------------------------------------------------------- internals

  private async loadChats(userId: string, condition: SQL): Promise<ChatDto[]> {
    const rows = await this.db
      .select({ chat: chats, peerId: peer.userId })
      .from(me)
      .innerJoin(chats, eq(chats.id, me.chatId))
      .innerJoin(peer, and(eq(peer.chatId, chats.id), ne(peer.userId, me.userId)))
      .where(and(eq(me.userId, userId), condition))
      .orderBy(desc(sql`coalesce(${chats.lastMessageAt}, ${chats.createdAt})`));
    if (rows.length === 0) return [];

    const chatIds = rows.map((r) => r.chat.id);
    const [lastMessages, unreadRows, peers] = await Promise.all([
      this.db
        .selectDistinctOn([messages.chatId])
        .from(messages)
        .where(inArray(messages.chatId, chatIds))
        .orderBy(messages.chatId, desc(messages.createdAt), desc(messages.id)),
      this.db
        .select({ chatId: messages.chatId, unread: count() })
        .from(messages)
        .innerJoin(me, and(eq(me.chatId, messages.chatId), eq(me.userId, userId)))
        .where(
          and(
            inArray(messages.chatId, chatIds),
            sql`${messages.senderId} is distinct from ${userId}`,
            sql`${messages.createdAt} > ${me.lastReadAt}`,
          ),
        )
        .groupBy(messages.chatId),
      this.people.summaries(rows.map((r) => r.peerId)),
    ]);
    const lastByChat = new Map(lastMessages.map((m) => [m.chatId, m]));
    const unreadByChat = new Map(unreadRows.map((u) => [u.chatId, u.unread]));

    return rows.map(({ chat, peerId }) => {
      const last = lastByChat.get(chat.id);
      return {
        id: chat.id,
        kind: chat.kind,
        peer: peers.get(peerId)!,
        lastMessage: last
          ? { text: last.body, kind: last.kind, mine: last.senderId === userId, createdAt: last.createdAt }
          : null,
        unread: unreadByChat.get(chat.id) ?? 0,
        expiresAt: chat.expiresAt,
        closedAt: chat.closedAt,
        createdAt: chat.createdAt,
      };
    });
  }

  /** The chat, the other participant and their read progress — or 404 if I am not in it. */
  private async membership(userId: string, chatId: string): Promise<Membership> {
    const [row] = await this.db
      .select({
        chat: chats,
        peerId: peer.userId,
        peerReadAt: peer.lastReadAt,
        peerDeliveredAt: peer.lastDeliveredAt,
      })
      .from(me)
      .innerJoin(chats, eq(chats.id, me.chatId))
      .innerJoin(peer, and(eq(peer.chatId, chats.id), ne(peer.userId, me.userId)))
      .where(and(eq(me.userId, userId), eq(me.chatId, chatId)));
    if (!row) throw notFound('Chat');
    return {
      chat: row.chat,
      peerId: row.peerId,
      peer: { lastReadAt: row.peerReadAt, lastDeliveredAt: row.peerDeliveredAt },
    };
  }

  private async assertCanSend(userId: string, chatId: string): Promise<Membership> {
    const membership = await this.membership(userId, chatId);
    const { chat, peerId } = membership;
    if (chat.closedAt) throw forbidden('This chat has been closed', ErrorCode.CHAT_CLOSED);
    if (chat.expiresAt && chat.expiresAt <= new Date()) {
      throw forbidden('Time is up for this quick chat', ErrorCode.CHAT_EXPIRED);
    }
    const [blocked] = await this.db
      .select({ x: sql`1` })
      .from(blocks)
      .where(
        or(
          and(eq(blocks.blockerId, userId), eq(blocks.blockedId, peerId)),
          and(eq(blocks.blockerId, peerId), eq(blocks.blockedId, userId)),
        ),
      )
      .limit(1);
    if (blocked) throw forbidden('You cannot message this person', ErrorCode.USER_BLOCKED);
    return membership;
  }

  /** Bumps the chat in the list and marks everything up to my own message as read for me. */
  private async afterInsert(tx: DbExecutor, chatId: string, senderId: string, at: Date) {
    await tx.update(chats).set({ lastMessageAt: at }).where(eq(chats.id, chatId));
    await tx
      .update(chatParticipants)
      .set({ lastReadAt: at, lastDeliveredAt: at })
      .where(and(eq(chatParticipants.chatId, chatId), eq(chatParticipants.userId, senderId)));
  }

  private async broadcast(membership: Membership, senderId: string, message: Message) {
    this.realtime.emitToUser(senderId, 'message.new', toMessageDto(message, senderId, membership.peer));
    this.realtime.emitToUser(membership.peerId, 'message.new', toMessageDto(message, membership.peerId, membership.peer));

    const [sender] = (await this.people.summaries([senderId])).values();
    this.push.notify(membership.peerId, {
      title: sender?.name ?? 'New message',
      body: message.kind === 'gift' ? `Sent you ${message.coins} coins 🎁` : message.body,
      data: { type: 'message', chatId: message.chatId },
    });
  }

  private async markDelivered(userId: string, chatIds: string[]) {
    if (chatIds.length === 0) return;
    await this.db
      .update(chatParticipants)
      .set({ lastDeliveredAt: sql`now()` })
      .where(and(eq(chatParticipants.userId, userId), inArray(chatParticipants.chatId, chatIds)));
  }

  private async findOpenFriendChat(db: DbExecutor, key: string) {
    const [chat] = await db
      .select({ id: chats.id })
      .from(chats)
      .where(and(eq(chats.pairKey, key), eq(chats.kind, 'friend'), isNull(chats.closedAt)));
    return chat;
  }
}

function toMessageDto(m: Message, viewerId: string, peer: PeerProgress): MessageDto {
  const mine = m.senderId === viewerId;
  let status: MessageStatus | null = null;
  if (mine) {
    status = peer.lastReadAt >= m.createdAt ? 'read' : peer.lastDeliveredAt >= m.createdAt ? 'delivered' : 'sent';
  }
  return {
    id: m.id,
    chatId: m.chatId,
    senderId: m.senderId,
    mine,
    kind: m.kind,
    text: m.body,
    coins: m.coins,
    imageUrl: m.imageUrl,
    status,
    createdAt: m.createdAt,
  };
}
