export class DashboardTotalsDto {
  /** Accounts that are not deleted. */
  users: number;
  newUsers7d: number;
  activeUsers24h: number;
  onboardedUsers: number;
  proUsers: number;
  verifiedUsers: number;
  suspendedUsers: number;
  pendingVerifications: number;
  openReports: number;
  posts: number;
  messages24h: number;
  openChats: number;
  activeQuickMatches: number;
  /** Sum of every user's coin balance. */
  coinsInCirculation: number;
}

export class RevenueDto {
  currency: string;
  amountCents: number;
  payments: number;
}

export class DailyPointDto {
  /** `YYYY-MM-DD` (UTC). */
  date: string;
  value: number;
}

export class DashboardDto {
  totals: DashboardTotalsDto;
  /** Store payments in the last 30 days, per currency. */
  revenue30d: RevenueDto[];
  /** New accounts per day, last 30 days. */
  signups: DailyPointDto[];
  /** Messages sent per day, last 30 days. */
  messages: DailyPointDto[];
}
