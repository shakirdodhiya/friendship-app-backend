import { sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

import { userPhotos } from '../../../database/schema';

type UserRefSource = Record<
  'id' | 'name' | 'email' | 'phone' | 'avatarTint' | 'verificationStatus' | 'suspendedAt' | 'deletedAt',
  AnyPgColumn
>;

/**
 * Columns for an `AdminUserRefDto`. Takes the table so it also works with aliases,
 * e.g. reporter and reported user on the same report row; `tableName` is the alias, if any.
 */
export function userRefColumns(t: UserRefSource, tableName = 'users') {
  // Drizzle leaves columns unqualified in single-table selects, where a bare "id" inside the
  // subquery would bind to user_photos.id. Spell out the outer reference.
  const outerId = sql`${sql.identifier(tableName)}.${sql.identifier('id')}`;
  return {
    id: sql<string>`${t.id}`,
    name: sql<string | null>`${t.name}`,
    email: sql<string | null>`${t.email}`,
    phone: sql<string | null>`${t.phone}`,
    avatarTint: sql<string | null>`${t.avatarTint}`,
    photoUrl: sql<string | null>`(select ${userPhotos.url} from ${userPhotos}
      where ${userPhotos.userId} = ${outerId} order by ${userPhotos.position} limit 1)`,
    verified: sql<boolean>`${t.verificationStatus} = 'verified'`,
    suspended: sql<boolean>`${t.suspendedAt} is not null`,
    deleted: sql<boolean>`${t.deletedAt} is not null`,
  };
}
