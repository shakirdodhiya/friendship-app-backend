import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';

import { PaginationQueryDto, toPage } from '../../common/dto/pagination.dto';
import { badRequest } from '../../common/errors';
import { DB, type Database } from '../../database/database.module';
import { blocks, likes, reports, users } from '../../database/schema';
import { ChatsService } from '../chats/chats.service';
import { PeopleService } from '../people/people.service';
import { RealtimeService } from '../realtime/realtime.service';
import { UsersService } from '../users/users.service';
import type { PeoplePageDto } from '../discover/dto/discover.dto';
import type { BlockedUserDto, CreateReportDto, LikeResultDto } from './dto/social.dto';

@Injectable()
export class SocialService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly users: UsersService,
    private readonly people: PeopleService,
    private readonly chats: ChatsService,
    private readonly realtime: RealtimeService,
  ) {}

  async like(userId: string, targetId: string): Promise<LikeResultDto> {
    const viewer = await this.users.findActive(userId);
    const target = await this.people.getById(viewer, this.notSelf(userId, targetId));
    await this.db.insert(likes).values({ likerId: userId, likeeId: targetId }).onConflictDoNothing();
    return { liked: true, mutual: target.likesMe };
  }

  async unlike(userId: string, targetId: string): Promise<void> {
    await this.db.delete(likes).where(and(eq(likes.likerId, userId), eq(likes.likeeId, targetId)));
  }

  /** People I liked, most recent first. */
  async sent(userId: string, query: PaginationQueryDto): Promise<PeoplePageDto> {
    return this.likedPeople(userId, query, 'sent');
  }

  /** People who liked me, most recent first. */
  async received(userId: string, query: PaginationQueryDto): Promise<PeoplePageDto> {
    return this.likedPeople(userId, query, 'received');
  }

  /** Blocking hides both people from each other everywhere and closes any chat between them. */
  async block(userId: string, targetId: string): Promise<void> {
    this.notSelf(userId, targetId);
    await this.users.findActive(targetId);
    const closed = await this.db.transaction(async (tx) => {
      await tx.insert(blocks).values({ blockerId: userId, blockedId: targetId }).onConflictDoNothing();
      await tx
        .delete(likes)
        .where(
          sql`(${likes.likerId} = ${userId} and ${likes.likeeId} = ${targetId})
              or (${likes.likerId} = ${targetId} and ${likes.likeeId} = ${userId})`,
        );
      return this.chats.closeAllBetween(tx, userId, targetId);
    });
    for (const chatId of closed) {
      for (const id of [userId, targetId]) this.realtime.emitToUser(id, 'chat.closed', { chatId });
    }
  }

  async unblock(userId: string, targetId: string): Promise<void> {
    await this.db.delete(blocks).where(and(eq(blocks.blockerId, userId), eq(blocks.blockedId, targetId)));
  }

  async blocked(userId: string): Promise<BlockedUserDto[]> {
    const rows = await this.db
      .select({ user: users, blockedAt: blocks.createdAt })
      .from(blocks)
      .innerJoin(users, eq(users.id, blocks.blockedId))
      .where(eq(blocks.blockerId, userId))
      .orderBy(desc(blocks.createdAt));
    return rows.map((r) => ({ user: this.people.toSummary(r.user), blockedAt: r.blockedAt }));
  }

  async report(userId: string, dto: CreateReportDto): Promise<{ id: string }> {
    this.notSelf(userId, dto.userId);
    await this.users.findActive(dto.userId);
    const [report] = await this.db
      .insert(reports)
      .values({ reporterId: userId, reportedId: dto.userId, reason: dto.reason, details: dto.details })
      .returning({ id: reports.id });
    return report;
  }

  private async likedPeople(userId: string, query: PaginationQueryDto, direction: 'sent' | 'received') {
    const viewer = await this.users.findActive(userId);
    const [mine, theirs] = direction === 'sent' ? [likes.likerId, likes.likeeId] : [likes.likeeId, likes.likerId];
    const likedAt = sql`(select ${likes.createdAt} from ${likes} where ${mine} = ${userId} and ${theirs} = ${users.id})`;
    const rows = await this.people.find({
      viewer,
      where: [...this.people.visibleTo(userId), sql`${likedAt} is not null`],
      orderBy: [desc(likedAt), desc(users.id)],
      limit: query.limit + 1,
      offset: query.offset,
    });
    return toPage(rows, query);
  }

  private notSelf(userId: string, targetId: string): string {
    if (userId === targetId) throw badRequest('You cannot do that to yourself');
    return targetId;
  }
}
