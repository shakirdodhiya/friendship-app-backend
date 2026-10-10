import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, Length } from 'class-validator';

import { verificationStatusEnum, type VerificationStatus } from '../../../../database/schema';
import { AdminPageQueryDto, AdminUserRefDto, trim } from '../../common/admin-page.dto';

export class VerificationsQueryDto extends AdminPageQueryDto {
  /** Defaults to the review queue. */
  @IsOptional()
  @IsIn(['pending', 'verified', 'rejected'])
  status: Exclude<VerificationStatus, 'unverified'> = 'pending';
}

export class VerificationRequestDto {
  id: string;
  user: AdminUserRefDto;
  selfieUrl: string;
  /** The user's profile photos, to compare against the selfie. */
  photoUrls: string[];
  @ApiProperty({ enum: verificationStatusEnum.enumValues })
  status: VerificationStatus;
  reviewNote: string | null;
  reviewedAt: Date | null;
  reviewedBy: { id: string; name: string } | null;
  createdAt: Date;
}

export class VerificationPageDto {
  items: VerificationRequestDto[];
  total: number;
  page: number;
  pageSize: number;
}

export class ReviewVerificationDto {
  @IsIn(['approve', 'reject'])
  decision: 'approve' | 'reject';

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(0, 500)
  note?: string;
}
