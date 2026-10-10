import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { chatKindEnum, messageKindEnum } from './enums';
import { users } from './users';

export const chats = pgTable(
  'chats',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    kind: chatKindEnum('kind').notNull().default('friend'),
    /** Both member ids sorted and joined with ":" — lets the DB enforce one friend chat per pair. */
    pairKey: text('pair_key').notNull(),
    createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
    /** Quick chats stop accepting messages at this time. Null for friend chats. */
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    /** Set when someone leaves the chat or a quick chat ends without both keeping it. */
    closedAt: timestamp('closed_at', { withTimezone: true }),
    lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('chats_open_friend_pair_key')
      .on(t.pairKey)
      .where(sql`${t.kind} = 'friend' and ${t.closedAt} is null`),
    index('chats_last_message_idx').on(t.lastMessageAt),
  ],
);

export const chatParticipants = pgTable(
  'chat_participants',
  {
    chatId: uuid('chat_id')
      .notNull()
      .references(() => chats.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Messages from others created after this are unread. */
    lastReadAt: timestamp('last_read_at', { withTimezone: true }).notNull().defaultNow(),
    /** Messages from others created after this have not reached this user's device yet. */
    lastDeliveredAt: timestamp('last_delivered_at', { withTimezone: true }).notNull().defaultNow(),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.chatId, t.userId] }),
    index('chat_participants_user_idx').on(t.userId),
  ],
);

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    chatId: uuid('chat_id')
      .notNull()
      .references(() => chats.id, { onDelete: 'cascade' }),
    /** Null for system messages. */
    senderId: uuid('sender_id').references(() => users.id, { onDelete: 'set null' }),
    kind: messageKindEnum('kind').notNull().default('text'),
    body: text('body').notNull(),
    coins: integer('coins'),
    imageUrl: text('image_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('messages_chat_created_idx').on(t.chatId, t.createdAt),
    check('messages_gift_has_coins', sql`${t.kind} <> 'gift' or ${t.coins} > 0`),
  ],
);

export type Chat = typeof chats.$inferSelect;
export type ChatParticipant = typeof chatParticipants.$inferSelect;
export type Message = typeof messages.$inferSelect;
