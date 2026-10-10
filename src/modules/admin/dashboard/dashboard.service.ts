import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';

import { DB, type Database } from '../../../database/database.module';
import {
  chats,
  messages,
  payments,
  posts,
  quickMatches,
  reports,
  users,
  verificationRequests,
} from '../../../database/schema';
import type { DailyPointDto, DashboardDto, DashboardTotalsDto, RevenueDto } from './dto/dashboard.dto';

const DAYS = 30;

@Injectable()
export class DashboardService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async get(): Promise<DashboardDto> {
    const [totals, revenue30d, signups, messageSeries] = await Promise.all([
      this.totals(),
      this.revenue(),
      this.daily(sql`${users}`, sql`${users.createdAt}`),
      this.daily(sql`${messages}`, sql`${messages.createdAt}`),
    ]);
    return { totals, revenue30d, signups, messages: messageSeries };
  }

  private async totals(): Promise<DashboardTotalsDto> {
    const live = sql`${users.deletedAt} is null`;
    const { rows } = await this.db.execute<Record<keyof DashboardTotalsDto, number>>(sql`
      select
        (select count(*)::int from ${users} where ${live}) as "users",
        (select count(*)::int from ${users} where ${live} and ${users.createdAt} > now() - interval '7 days') as "newUsers7d",
        (select count(*)::int from ${users} where ${live} and ${users.lastActiveAt} > now() - interval '24 hours') as "activeUsers24h",
        (select count(*)::int from ${users} where ${live} and ${users.onboardingCompletedAt} is not null) as "onboardedUsers",
        (select count(*)::int from ${users} where ${live} and ${users.proUntil} > now()) as "proUsers",
        (select count(*)::int from ${users} where ${live} and ${users.verificationStatus} = 'verified') as "verifiedUsers",
        (select count(*)::int from ${users} where ${live} and ${users.suspendedAt} is not null) as "suspendedUsers",
        (select count(*)::int from ${verificationRequests} where ${verificationRequests.status} = 'pending') as "pendingVerifications",
        (select count(*)::int from ${reports} where ${reports.status} = 'open') as "openReports",
        (select count(*)::int from ${posts} where ${posts.deletedAt} is null) as "posts",
        (select count(*)::int from ${messages} where ${messages.createdAt} > now() - interval '24 hours') as "messages24h",
        (select count(*)::int from ${chats} where ${chats.closedAt} is null
           and (${chats.expiresAt} is null or ${chats.expiresAt} > now())) as "openChats",
        (select count(*)::int from ${quickMatches} where ${quickMatches.status} in ('waiting', 'active')) as "activeQuickMatches",
        (select coalesce(sum(${users.coinBalance}), 0)::int from ${users} where ${live}) as "coinsInCirculation"
    `);
    return rows[0];
  }

  private async revenue(): Promise<RevenueDto[]> {
    const { rows } = await this.db.execute<{ currency: string; amountCents: number; payments: number }>(sql`
      select ${payments.currency} as "currency",
             coalesce(sum(${payments.amountCents}), 0)::int as "amountCents",
             count(*)::int as "payments"
      from ${payments}
      where ${payments.createdAt} > now() - interval '30 days' and ${payments.provider} <> 'test'
      group by ${payments.currency}
      order by 2 desc
    `);
    return rows;
  }

  /** One point per UTC day for the last `DAYS` days, including days with zero rows. */
  private async daily(table: ReturnType<typeof sql>, column: ReturnType<typeof sql>): Promise<DailyPointDto[]> {
    const { rows } = await this.db.execute<{ date: string; value: number }>(sql`
      select to_char(d.day, 'YYYY-MM-DD') as "date", coalesce(c.n, 0)::int as "value"
      from generate_series(
        (now() at time zone 'utc')::date - ${DAYS - 1}::int,
        (now() at time zone 'utc')::date,
        interval '1 day'
      ) as d(day)
      left join (
        select (${column} at time zone 'utc')::date as day, count(*) as n
        from ${table}
        where ${column} >= (now() at time zone 'utc')::date - ${DAYS - 1}::int
        group by 1
      ) c on c.day = d.day::date
      order by d.day
    `);
    return rows;
  }
}
