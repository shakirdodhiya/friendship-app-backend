import { sql } from 'drizzle-orm';
import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { adminRoleEnum } from './enums';

/**
 * Staff accounts for the admin portal. Kept apart from `users` on purpose:
 * admins sign in with email + password (not Firebase) and never appear in the app.
 */
export const adminUsers = pgTable(
  'admin_users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Stored lower-cased. */
    email: text('email').notNull(),
    name: text('name').notNull(),
    /** `scrypt$<N>$<r>$<p>$<salt>$<hash>`, see `admin/common/password.ts`. */
    passwordHash: text('password_hash').notNull(),
    role: adminRoleEnum('role').notNull().default('admin'),
    /** Bumped on password change or deactivation; tokens carrying an older version stop working. */
    tokenVersion: integer('token_version').notNull().default(0),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    /** Deactivated admins cannot sign in. */
    disabledAt: timestamp('disabled_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex('admin_users_email_key').on(sql`lower(${t.email})`)],
);

/** Append-only record of what admins changed, shown on the portal's audit log page. */
export const adminAuditLogs = pgTable(
  'admin_audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    adminId: uuid('admin_id').references(() => adminUsers.id, { onDelete: 'set null' }),
    /** e.g. `user.suspend`, `post.delete`, `coin_pack.update`. */
    action: text('action').notNull(),
    targetType: text('target_type').notNull(),
    targetId: text('target_id'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('admin_audit_logs_created_idx').on(t.createdAt),
    index('admin_audit_logs_target_idx').on(t.targetType, t.targetId),
  ],
);

export type AdminUser = typeof adminUsers.$inferSelect;
export type AdminAuditLog = typeof adminAuditLogs.$inferSelect;
