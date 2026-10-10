import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, Length } from 'class-validator';

import {
  reportReasonEnum,
  reportStatusEnum,
  type ReportReason,
  type ReportStatus,
} from '../../../../database/schema';
import { AdminPageQueryDto, AdminUserRefDto, trim } from '../../common/admin-page.dto';

export class ReportsQueryDto extends AdminPageQueryDto {
  @IsOptional()
  @IsIn([...reportStatusEnum.enumValues, 'all'])
  status: ReportStatus | 'all' = 'open';

  @IsOptional()
  @IsIn(reportReasonEnum.enumValues)
  reason?: ReportReason;

  /** Reports about this user only. */
  @IsOptional()
  @IsUUID()
  reportedId?: string;
}

export class ReportDto {
  id: string;
  reporter: AdminUserRefDto;
  reported: AdminUserRefDto;
  @ApiProperty({ enum: reportReasonEnum.enumValues })
  reason: ReportReason;
  details: string | null;
  @ApiProperty({ enum: reportStatusEnum.enumValues })
  status: ReportStatus;
  /** Every report ever filed against the reported user. */
  reportedUserReportCount: number;
  resolutionNote: string | null;
  resolvedAt: Date | null;
  resolvedBy: { id: string; name: string } | null;
  createdAt: Date;
}

export class ReportPageDto {
  items: ReportDto[];
  total: number;
  page: number;
  pageSize: number;
}

export class ResolveReportDto {
  /** `resolved`: action was taken. `dismissed`: nothing wrong. `open`: reopen. */
  @IsIn(reportStatusEnum.enumValues)
  status: ReportStatus;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(0, 1000)
  note?: string;

  /** Also suspend the reported user, with the note as the reason. */
  @IsOptional()
  @IsBoolean()
  suspendUser?: boolean;
}
