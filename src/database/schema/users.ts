import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { adminUsers } from './admins';
import { genderEnum, verificationStatusEnum } from './enums';

/** Avatar studio selection: category name → option index, e.g. `{ "Tone": 3, "Hair": 7 }`. */
export type AvatarConfig = Record<string, number>;

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Firebase Auth uid. Nulled when the account is deleted so the same login can start fresh. */
    firebaseUid: text('firebase_uid'),
    /** Firebase sign-in method of the latest login: `phone`, `google.com`, `apple.com`… */
    authProvider: text('auth_provider'),
    /** E.164, synced from the Firebase token. */
    phone: text('phone'),
    /** Synced from the Firebase token (Google / Apple sign-in). */
    email: text('email'),

    name: text('name'),
    birthday: date('birthday', { mode: 'string' }),
    gender: genderEnum('gender'),
    interestedIn: genderEnum('interested_in'),
    heightCm: smallint('height_cm'),

    jobRole: text('job_role'),
    jobDepartment: text('job_department'),
    /** "Keep my work details hidden" on the work step. */
    hideWork: boolean('hide_work').notNull().default(false),

    country: text('country'),
    state: text('state'),
    city: text('city'),
    latitude: doublePrecision('latitude'),
    longitude: doublePrecision('longitude'),

    languages: text('languages').array().notNull().default(sql`'{}'::text[]`),
    zodiac: text('zodiac'),
    personality: text('personality'),
    interests: text('interests').array().notNull().default(sql`'{}'::text[]`),
    shortBio: text('short_bio'),
    longBio: text('long_bio'),

    avatar: jsonb('avatar').$type<AvatarConfig>().notNull().default({}),
    /** Plate colour drawn behind the illustrated avatar. */
    avatarTint: text('avatar_tint'),

    verificationStatus: verificationStatusEnum('verification_status').notNull().default('unverified'),
    notificationsEnabled: boolean('notifications_enabled').notNull().default(false),

    /** Denormalised balance; every change is mirrored by a row in `coin_transactions`. */
    coinBalance: integer('coin_balance').notNull().default(0),
    /** Pro is active while this is in the future. Source of truth for the history is `subscriptions`. */
    proUntil: timestamp('pro_until', { withTimezone: true }),

    onboardingCompletedAt: timestamp('onboarding_completed_at', { withTimezone: true }),
    /** Set by an admin. Suspended users are rejected by the auth guard and hidden from other people. */
    suspendedAt: timestamp('suspended_at', { withTimezone: true }),
    suspensionReason: text('suspension_reason'),
    lastActiveAt: timestamp('last_active_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('users_firebase_uid_key').on(t.firebaseUid),
    index('users_phone_idx').on(t.phone),
    index('users_last_active_idx').on(t.lastActiveAt),
    index('users_discoverable_idx')
      .on(t.onboardingCompletedAt)
      .where(sql`${t.deletedAt} is null`),
    check('users_coin_balance_nonnegative', sql`${t.coinBalance} >= 0`),
    check('users_height_range', sql`${t.heightCm} is null or ${t.heightCm} between 100 and 250`),
  ],
);

export const userPhotos = pgTable(
  'user_photos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    /** Slot on the 6-slot photo grid, 0-based. */
    position: smallint('position').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('user_photos_user_position_key').on(t.userId, t.position),
    check('user_photos_position_range', sql`${t.position} between 0 and 5`),
  ],
);

export const verificationRequests = pgTable(
  'verification_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    selfieUrl: text('selfie_url').notNull(),
    status: verificationStatusEnum('status').notNull().default('pending'),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewedById: uuid('reviewed_by_id').references(() => adminUsers.id, { onDelete: 'set null' }),
    /** Shown to the reviewer team only. */
    reviewNote: text('review_note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('verification_requests_user_idx').on(t.userId),
    index('verification_requests_status_created_idx').on(t.status, t.createdAt),
  ],
);

/** Premium avatar studio options a user has paid for. */
export const avatarItems = pgTable(
  'avatar_items',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    category: text('category').notNull(),
    optionIndex: smallint('option_index').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.category, t.optionIndex] })],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UserPhoto = typeof userPhotos.$inferSelect;
export type VerificationRequest = typeof verificationRequests.$inferSelect;
