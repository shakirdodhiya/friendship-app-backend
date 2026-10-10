import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

import { reportReasonEnum } from '../../../database/schema';
import type { ReportReason } from '../../../database/schema';
import { PersonSummaryDto } from '../../people/dto/person.dto';

export class LikeResultDto {
  liked: boolean;
  /** True when they had already liked me too. */
  mutual: boolean;
}

export class BlockedUserDto {
  user: PersonSummaryDto;
  blockedAt: Date;
}

export class CreateReportDto {
  @IsUUID()
  userId: string;

  @ApiProperty({ enum: reportReasonEnum.enumValues })
  @IsIn(reportReasonEnum.enumValues)
  reason: ReportReason;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(1000)
  details?: string;
}

export class ReportCreatedDto {
  id: string;
}
