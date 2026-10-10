import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, ne, or, sql } from 'drizzle-orm';

import { badRequest, conflict, ErrorCode, forbidden, notFound } from '../../common/errors';
import { AppConfig } from '../../config/app-config.service';
import { DB, type Database, type DbExecutor } from '../../database/database.module';
import { blocks, QuickMatch, quickMatches } from '../../database/schema';
import type { QuickMatchDecision } from '../../database/schema';
import { ChatsService } from '../chats/chats.service';
import { PeopleService } from '../people/people.service';
import { RealtimeService } from '../realtime/realtime.service';
import { UsersService } from '../users/users.service';
import { WalletLedgerService } from '../wallet/wallet-ledger.service';
import type { CurrentQuickMatchDto, QuickMatchDto } from './dto/quick-match.dto';

/** Time after the chat ends to decide; afterwards a missing decision counts as "pass". */
const DECISION_WINDOW_MS = 10 * 60 * 1000;
/** Decisions may arrive this early (capped at 10% of the match) to absorb device/server clock skew. */
const CLOCK_SKEW_MS = 5 * 1000;

const involves = (userId: string) => or(eq(quickMatches.userAId, userId), eq(quickMatches.userBId, userId));
const isOpen = sql`${quickMatches.status} in ('waiting', 'active')`;

@Injectable()
export class QuickMatchService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly config: AppConfig,
    private readonly users: UsersService,
    private readonly people: PeopleService,
    private readonly chats: ChatsService,
    private readonly ledger: WalletLedgerService,
    private readonly realtime: RealtimeService,
  ) {}

  async current(userId: string): Promise<CurrentQuickMatchDto> {
    const match = await this.findOpen(userId);
    return {
      match: match ? await this.toDto(match, userId) : null,
      cost: this.config.get('QUICK_MATCH_COST'),
      durationSeconds: this.config.get('QUICK_MATCH_DURATION_SECONDS'),
    };
  }

  async get(userId: string, matchId: string): Promise<QuickMatchDto> {
    const match = await this.finalizeIfStale(await this.load(userId, matchId));
    return this.toDto(match, userId);
  }

  /**
   * Pays the entry cost and either pairs with the longest-waiting compatible user or joins the queue.
   * Whoever was waiting gets a `quickMatch.updated` event when paired.
   */
  async join(userId: string): Promise<QuickMatchDto> {
    await this.users.assertOnboarded(userId);
    if (await this.findOpen(userId)) {
      throw conflict('You are already in a quick match', ErrorCode.QUICK_MATCH_IN_PROGRESS);
    }

    const cost = this.config.get('QUICK_MATCH_COST');
    const durationMs = this.config.get('QUICK_MATCH_DURATION_SECONDS') * 1000;

    const { match, coins } = await this.db.transaction(async (tx) => {
      // SKIP LOCKED: two joiners never grab the same waiting user.
      const [candidate] = await tx
        .select()
        .from(quickMatches)
        .where(
          and(
            eq(quickMatches.status, 'waiting'),
            ne(quickMatches.userAId, userId),
            sql`not exists (
              select 1 from ${blocks}
              where (${blocks.blockerId} = ${userId} and ${blocks.blockedId} = ${quickMatches.userAId})
                 or (${blocks.blockerId} = ${quickMatches.userAId} and ${blocks.blockedId} = ${userId})
            )`,
          ),
        )
        .orderBy(asc(quickMatches.createdAt))
        .limit(1)
        .for('update', { skipLocked: true });

      let match: QuickMatch;
      if (candidate) {
        const startedAt = new Date();
        const endsAt = new Date(startedAt.getTime() + durationMs);
        const chatId = await this.chats.createQuickChat(tx, candidate.userAId, userId, endsAt);
        [match] = await tx
          .update(quickMatches)
          .set({ userBId: userId, status: 'active', chatId, startedAt, endsAt })
          .where(eq(quickMatches.id, candidate.id))
          .returning();
      } else {
        [match] = await tx.insert(quickMatches).values({ userAId: userId }).returning();
      }

      const coins = await this.ledger.apply(tx, {
        userId,
        amount: -cost,
        type: 'quick_match',
        referenceId: match.id,
      });
      return { match, coins };
    });

    this.realtime.emitToUser(userId, 'wallet.updated', { coins });
    if (match.status === 'active') await this.notifyBoth(match);
    return this.toDto(match, userId);
  }

  /** Leaves the queue and refunds the entry cost. Only possible before being paired. */
  async cancel(userId: string, matchId: string): Promise<QuickMatchDto> {
    const result = await this.db.transaction(async (tx) => {
      const [cancelled] = await tx
        .update(quickMatches)
        .set({ status: 'cancelled', completedAt: new Date() })
        .where(and(eq(quickMatches.id, matchId), eq(quickMatches.userAId, userId), eq(quickMatches.status, 'waiting')))
        .returning();
      if (!cancelled) return null;
      const coins = await this.ledger.apply(tx, {
        userId,
        amount: this.config.get('QUICK_MATCH_COST'),
        type: 'quick_match_refund',
        referenceId: matchId,
      });
      return { cancelled, coins };
    });
    if (!result) {
      await this.load(userId, matchId); // 404 if not mine
      throw badRequest('Only a match that is still waiting for a partner can be cancelled');
    }
    this.realtime.emitToUser(userId, 'wallet.updated', { coins: result.coins });
    return this.toDto(result.cancelled, userId);
  }

  /** Records keep / pass once time is up. When both have decided the match completes. */
  async decide(userId: string, matchId: string, decision: QuickMatchDecision): Promise<QuickMatchDto> {
    const match = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(quickMatches)
        .where(and(eq(quickMatches.id, matchId), involves(userId)))
        .for('update');
      if (!row) throw notFound('Quick match');
      if (row.status !== 'active' || !row.endsAt || !row.startedAt) throw badRequest('This quick match is not active');
      const skew = Math.min(CLOCK_SKEW_MS, (row.endsAt.getTime() - row.startedAt.getTime()) / 10);
      if (Date.now() < row.endsAt.getTime() - skew) {
        throw forbidden('You can decide once the timer runs out', ErrorCode.QUICK_MATCH_NOT_FINISHED);
      }

      const column = row.userAId === userId ? 'userADecision' : 'userBDecision';
      if (row[column]) throw conflict('You already decided');
      const [updated] = await tx
        .update(quickMatches)
        .set({ [column]: decision })
        .where(eq(quickMatches.id, matchId))
        .returning();
      return updated.userADecision && updated.userBDecision ? this.complete(tx, updated) : updated;
    });

    await this.notifyBoth(match);
    return this.toDto(match, userId);
  }

  // ---------------------------------------------------------------- internals

  private async load(userId: string, matchId: string): Promise<QuickMatch> {
    const [match] = await this.db
      .select()
      .from(quickMatches)
      .where(and(eq(quickMatches.id, matchId), involves(userId)));
    if (!match) throw notFound('Quick match');
    return match;
  }

  private async findOpen(userId: string): Promise<QuickMatch | undefined> {
    const [match] = await this.db
      .select()
      .from(quickMatches)
      .where(and(involves(userId), isOpen))
      .orderBy(desc(quickMatches.createdAt))
      .limit(1);
    if (!match) return undefined;
    const settled = await this.finalizeIfStale(match);
    return settled.status === 'waiting' || settled.status === 'active' ? settled : undefined;
  }

  /** Completes an active match whose decision window has passed; undecided counts as "pass". */
  private async finalizeIfStale(match: QuickMatch): Promise<QuickMatch> {
    if (match.status !== 'active' || !match.endsAt) return match;
    if (Date.now() < match.endsAt.getTime() + DECISION_WINDOW_MS) return match;

    const completed = await this.db.transaction(async (tx) => {
      const [row] = await tx.select().from(quickMatches).where(eq(quickMatches.id, match.id)).for('update');
      return row.status === 'active' ? this.complete(tx, row) : row;
    });
    await this.notifyBoth(completed);
    return completed;
  }

  private async complete(tx: DbExecutor, match: QuickMatch): Promise<QuickMatch> {
    const friends = match.userADecision === 'keep' && match.userBDecision === 'keep';
    let friendChatId: string | null = null;
    if (match.chatId && match.userBId) {
      if (friends) {
        friendChatId = await this.chats.promoteQuickChat(tx, match.chatId, match.userAId, match.userBId);
      } else {
        await this.chats.close(tx, match.chatId);
      }
    }
    const [completed] = await tx
      .update(quickMatches)
      .set({ status: 'completed', completedAt: new Date(), friendChatId })
      .where(eq(quickMatches.id, match.id))
      .returning();
    return completed;
  }

  private async notifyBoth(match: QuickMatch) {
    for (const id of [match.userAId, match.userBId]) {
      if (id) this.realtime.emitToUser(id, 'quickMatch.updated', await this.toDto(match, id));
    }
  }

  private async toDto(match: QuickMatch, viewerId: string): Promise<QuickMatchDto> {
    const isA = match.userAId === viewerId;
    const partnerId = isA ? match.userBId : match.userAId;
    const partner = partnerId ? ((await this.people.summaries([partnerId])).get(partnerId) ?? null) : null;
    const partnerDecision = isA ? match.userBDecision : match.userADecision;
    return {
      id: match.id,
      status: match.status,
      partner,
      chatId: match.chatId,
      startedAt: match.startedAt,
      endsAt: match.endsAt,
      decideBy: match.endsAt ? new Date(match.endsAt.getTime() + DECISION_WINDOW_MS) : null,
      myDecision: isA ? match.userADecision : match.userBDecision,
      partnerDecided: partnerDecision !== null,
      result: match.status === 'completed' ? (match.friendChatId ? 'friends' : 'passed') : null,
      friendChatId: match.friendChatId,
      createdAt: match.createdAt,
    };
  }
}
