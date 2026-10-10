import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, inArray, isNotNull, isNull, ne, SQL, sql } from 'drizzle-orm';

import { PROFILE_LIMITS } from '../../common/constants/catalog';
import { notFound } from '../../common/errors';
import { DB, type Database } from '../../database/database.module';
import { blocks, chats, likes, User, userPhotos, users } from '../../database/schema';
import { PresenceService } from '../realtime/presence.service';
import type { PhotoDto } from '../users/dto/me.dto';
import { isProActive, toPhotoDto } from '../users/users.mapper';
import type { PersonDto, PersonSummaryDto } from './dto/person.dto';

export interface PeopleQuery {
  viewer: User;
  where?: (SQL | undefined)[];
  orderBy?: SQL[];
  limit: number;
  offset: number;
}

/** Reusable SQL fragments over the `users` table. */
export const personSql = {
  age: sql<number | null>`extract(year from age(${users.birthday}))::int`,
  isPro: sql<boolean>`coalesce(${users.proUntil} > now(), false)`,
  /** Great-circle distance in km from a point, or NULL when the user has no coordinates. */
  distanceFrom(lat: number | null, lng: number | null): SQL<number | null> {
    if (lat === null || lng === null) return sql<null>`null::float8`;
    return sql<number | null>`case when ${users.latitude} is null or ${users.longitude} is null then null else
      6371 * acos(least(1, greatest(-1,
        cos(radians(${lat}::float8)) * cos(radians(${users.latitude})) * cos(radians(${users.longitude}) - radians(${lng}::float8))
        + sin(radians(${lat}::float8)) * sin(radians(${users.latitude}))
      ))) end`;
  },
  /** Neither side has blocked the other. */
  notBlockedWith(viewerId: string): SQL {
    return sql`not exists (
      select 1 from ${blocks}
      where (${blocks.blockerId} = ${viewerId} and ${blocks.blockedId} = ${users.id})
         or (${blocks.blockerId} = ${users.id} and ${blocks.blockedId} = ${viewerId})
    )`;
  },
};

/** Builds public profiles. Every list of people in the API goes through here so the shape never diverges. */
@Injectable()
export class PeopleService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly presence: PresenceService,
  ) {}

  /** Conditions for a profile the viewer is allowed to see in lists. */
  visibleTo(viewerId: string): SQL[] {
    return [
      isNull(users.deletedAt),
      isNull(users.suspendedAt),
      isNotNull(users.onboardingCompletedAt),
      ne(users.id, viewerId),
      personSql.notBlockedWith(viewerId),
    ];
  }

  async find(query: PeopleQuery): Promise<PersonDto[]> {
    const { viewer } = query;
    const pair = sql`least(${viewer.id}::text, ${users.id}::text) || ':' || greatest(${viewer.id}::text, ${users.id}::text)`;

    const rows = await this.db
      .select({
        user: users,
        age: personSql.age,
        distanceKm: personSql.distanceFrom(viewer.latitude, viewer.longitude),
        likedByMe: sql<boolean>`exists (select 1 from ${likes} where ${likes.likerId} = ${viewer.id} and ${likes.likeeId} = ${users.id})`,
        likesMe: sql<boolean>`exists (select 1 from ${likes} where ${likes.likerId} = ${users.id} and ${likes.likeeId} = ${viewer.id})`,
        chatId: sql<string | null>`(select ${chats.id} from ${chats}
          where ${chats.pairKey} = ${pair} and ${chats.kind} = 'friend' and ${chats.closedAt} is null limit 1)`,
      })
      .from(users)
      .where(and(...(query.where ?? [])))
      .orderBy(...(query.orderBy ?? [asc(users.createdAt)]))
      .limit(query.limit)
      .offset(query.offset);

    const unlocked = rows.filter((r) => r.chatId !== null).map((r) => r.user.id);
    const photos = await this.photosFor(unlocked);

    return rows.map((r) => {
      const u = r.user;
      const photosLocked = r.chatId === null;
      return {
        id: u.id,
        name: u.name ?? '',
        age: r.age,
        gender: u.gender,
        verified: u.verificationStatus === 'verified',
        pro: isProActive(u),
        online: this.presence.isOnline(u.id, u.lastActiveAt),
        lastActiveAt: u.lastActiveAt,
        location: u.city ?? u.state ?? u.country,
        job: u.hideWork ? null : u.jobRole,
        heightCm: u.heightCm,
        distanceKm: r.distanceKm === null ? null : Math.round(r.distanceKm),
        zodiac: u.zodiac,
        personality: u.personality,
        languages: u.languages,
        shortBio: u.shortBio,
        longBio: u.longBio,
        interests: u.interests,
        topMatched: u.interests
          .filter((i) => viewer.interests.includes(i))
          .slice(0, PROFILE_LIMITS.topMatchedInterests),
        avatar: { config: u.avatar, tint: u.avatarTint },
        photosLocked,
        photos: photosLocked ? [] : (photos.get(u.id) ?? []),
        likedByMe: r.likedByMe,
        likesMe: r.likesMe,
        chatId: r.chatId,
        joinedAt: u.createdAt,
      };
    });
  }

  /** One profile. Blocked, deleted and unfinished profiles are reported as not found. */
  async getById(viewer: User, personId: string): Promise<PersonDto> {
    const [person] = await this.find({
      viewer,
      where: [eq(users.id, personId), ...this.visibleTo(viewer.id)],
      limit: 1,
      offset: 0,
    });
    if (!person) throw notFound('User');
    return person;
  }

  /** Compact identities keyed by id. Deleted accounts come back as "Deleted user". */
  async summaries(userIds: string[]): Promise<Map<string, PersonSummaryDto>> {
    const ids = [...new Set(userIds)];
    if (ids.length === 0) return new Map();
    const rows = await this.db.select().from(users).where(inArray(users.id, ids));
    return new Map(rows.map((u) => [u.id, this.toSummary(u)]));
  }

  toSummary(u: User): PersonSummaryDto {
    const deleted = u.deletedAt !== null;
    return {
      id: u.id,
      name: deleted ? 'Deleted user' : (u.name ?? ''),
      avatar: { config: deleted ? {} : u.avatar, tint: u.avatarTint },
      verified: !deleted && u.verificationStatus === 'verified',
      pro: !deleted && isProActive(u),
      online: !deleted && this.presence.isOnline(u.id, u.lastActiveAt),
    };
  }

  private async photosFor(userIds: string[]): Promise<Map<string, PhotoDto[]>> {
    const map = new Map<string, PhotoDto[]>();
    if (userIds.length === 0) return map;
    const rows = await this.db
      .select()
      .from(userPhotos)
      .where(inArray(userPhotos.userId, userIds))
      .orderBy(asc(userPhotos.position));
    for (const row of rows) {
      const list = map.get(row.userId) ?? [];
      list.push(toPhotoDto(row));
      map.set(row.userId, list);
    }
    return map;
  }
}
