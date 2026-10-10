import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

import { quickMatchDecisionEnum, quickMatchStatusEnum } from '../../../database/schema';
import type { QuickMatchDecision, QuickMatchStatus } from '../../../database/schema';
import { PersonSummaryDto } from '../../people/dto/person.dto';

export const QUICK_MATCH_RESULTS = ['friends', 'passed'] as const;
export type QuickMatchResult = (typeof QUICK_MATCH_RESULTS)[number];

export class QuickMatchDto {
  id: string;
  /** `waiting` → in the queue; `active` → chatting / deciding; `completed` / `cancelled` → over. */
  @ApiProperty({ enum: quickMatchStatusEnum.enumValues })
  status: QuickMatchStatus;
  partner: PersonSummaryDto | null;
  /** The timed chat; use the normal chat endpoints to message in it. */
  chatId: string | null;
  startedAt: Date | null;
  /** When chatting stops and the keep / pass decision opens. */
  endsAt: Date | null;
  /** After this, missing decisions count as "pass". */
  decideBy: Date | null;
  @ApiProperty({ enum: quickMatchDecisionEnum.enumValues, nullable: true })
  myDecision: QuickMatchDecision | null;
  /** Whether the partner has decided — not what they decided. */
  partnerDecided: boolean;
  /** Only once completed. */
  @ApiProperty({ enum: QUICK_MATCH_RESULTS, nullable: true })
  result: QuickMatchResult | null;
  /** When the result is `friends`: the chat to continue in. */
  friendChatId: string | null;
  createdAt: Date;
}

export class CurrentQuickMatchDto {
  /** My waiting or active match, or null. */
  match: QuickMatchDto | null;
  /** Coins charged to join. */
  cost: number;
  durationSeconds: number;
}

export class QuickMatchDecisionDto {
  @IsIn(quickMatchDecisionEnum.enumValues)
  decision: QuickMatchDecision;
}
