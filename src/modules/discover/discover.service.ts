import { HttpStatus, Injectable } from '@nestjs/common';
import { desc, eq, gt, inArray, or, sql, SQL } from 'drizzle-orm';

import { PRESENCE } from '../../common/constants/catalog';
import { toPage } from '../../common/dto/pagination.dto';
import { AppException, badRequest, ErrorCode } from '../../common/errors';
import { users } from '../../database/schema';
import { PersonDto } from '../people/dto/person.dto';
import { PeopleService, personSql } from '../people/people.service';
import { PresenceService } from '../realtime/presence.service';
import { isProActive } from '../users/users.mapper';
import { UsersService } from '../users/users.service';
import type { DiscoverQueryDto, PeoplePageDto } from './dto/discover.dto';

@Injectable()
export class DiscoverService {
  constructor(
    private readonly users: UsersService,
    private readonly people: PeopleService,
    private readonly presence: PresenceService,
  ) {}

  /** The home feed. Pro members are boosted ("Increased Visibility"), then the most recently active come first. */
  async feed(userId: string, query: DiscoverQueryDto): Promise<PeoplePageDto> {
    const viewer = await this.users.findActive(userId);
    const usesProFilters =
      query.minHeightCm !== undefined ||
      query.maxHeightCm !== undefined ||
      query.city !== undefined ||
      query.minBioLength !== undefined;
    if (usesProFilters && !isProActive(viewer)) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        ErrorCode.PRO_REQUIRED,
        'Searching by height, city or bio length is a Pro feature',
      );
    }

    const distance = personSql.distanceFrom(viewer.latitude, viewer.longitude);
    const maxDistance = query.filter === 'nearby' ? PRESENCE.nearbyKm : query.maxDistanceKm;
    if (maxDistance !== undefined && (viewer.latitude === null || viewer.longitude === null)) {
      throw badRequest('Share your location to filter by distance');
    }

    const where: (SQL | undefined)[] = [...this.people.visibleTo(userId)];
    switch (query.filter) {
      case 'new':
        where.push(gt(users.createdAt, sql`now() - make_interval(days => ${PRESENCE.newUserDays})`));
        break;
      case 'online': {
        const connected = this.presence.onlineUserIds();
        const recent = gt(users.lastActiveAt, sql`now() - make_interval(secs => ${PRESENCE.onlineWindowSeconds})`);
        where.push(connected.length > 0 ? or(recent, inArray(users.id, connected)) : recent);
        break;
      }
      case 'verified':
        where.push(eq(users.verificationStatus, 'verified'));
        break;
    }
    if (query.gender) where.push(eq(users.gender, query.gender));
    if (maxDistance !== undefined) where.push(sql`${distance} <= ${maxDistance}`);
    if (query.minAge !== undefined) where.push(sql`${personSql.age} >= ${query.minAge}`);
    if (query.maxAge !== undefined) where.push(sql`${personSql.age} <= ${query.maxAge}`);
    if (query.minHeightCm !== undefined) where.push(sql`${users.heightCm} >= ${query.minHeightCm}`);
    if (query.maxHeightCm !== undefined) where.push(sql`${users.heightCm} <= ${query.maxHeightCm}`);
    if (query.city) where.push(sql`lower(${users.city}) = lower(${query.city})`);
    if (query.minBioLength !== undefined) {
      where.push(sql`char_length(coalesce(${users.longBio}, '')) >= ${query.minBioLength}`);
    }
    if (query.interest) where.push(sql`${query.interest} = any(${users.interests})`);

    const rows = await this.people.find({
      viewer,
      where,
      orderBy: [desc(personSql.isPro), desc(users.lastActiveAt), desc(users.id)],
      limit: query.limit + 1,
      offset: query.offset,
    });
    return toPage(rows, query);
  }

  /**
   * The large card at the top of the home tab: a verified Pro member, rotating daily.
   * Falls back to anyone discoverable.
   */
  async spotlight(userId: string): Promise<PersonDto | null> {
    const viewer = await this.users.findActive(userId);
    const [person] = await this.people.find({
      viewer,
      where: this.people.visibleTo(userId),
      orderBy: [
        desc(sql`(${personSql.isPro} and ${users.verificationStatus} = 'verified')`),
        sql`md5(${users.id}::text || current_date::text)`,
      ],
      limit: 1,
      offset: 0,
    });
    return person ?? null;
  }
}
