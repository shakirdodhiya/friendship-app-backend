import { sql } from 'drizzle-orm';
import { index, pgTable, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { chats } from './chats';
import { quickMatchDecisionEnum, quickMatchStatusEnum } from './enums';
import { users } from './users';

/**
 * A 5-minute timed chat between two strangers.
 * `waiting` rows are the queue: `userAId` waits until someone else joins as `userBId`.
 */
export const quickMatches = pgTable(
  'quick_matches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userAId: uuid('user_a_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    userBId: uuid('user_b_id').references(() => users.id, { onDelete: 'cascade' }),
    status: quickMatchStatusEnum('status').notNull().default('waiting'),
    chatId: uuid('chat_id').references(() => chats.id, { onDelete: 'set null' }),
    /** Set when both kept the match: the friend chat they continue in. */
    friendChatId: uuid('friend_chat_id').references(() => chats.id, { onDelete: 'set null' }),
    userADecision: quickMatchDecisionEnum('user_a_decision'),
    userBDecision: quickMatchDecisionEnum('user_b_decision'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('quick_matches_status_created_idx').on(t.status, t.createdAt),
    index('quick_matches_user_b_idx').on(t.userBId),
    /** A user can wait in the queue only once at a time. */
    uniqueIndex('quick_matches_one_waiting_per_user')
      .on(t.userAId)
      .where(sql`${t.status} = 'waiting'`),
  ],
);

export type QuickMatch = typeof quickMatches.$inferSelect;
