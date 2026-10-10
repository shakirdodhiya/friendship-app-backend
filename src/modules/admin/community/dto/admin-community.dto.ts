import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsUUID } from 'class-validator';

import { AdminPageQueryDto, AdminUserRefDto, toBool } from '../../common/admin-page.dto';

export const POST_STATUSES = ['live', 'deleted', 'all'] as const;
export type PostStatusFilter = (typeof POST_STATUSES)[number];

export class AdminPostsQueryDto extends AdminPageQueryDto {
  @IsOptional()
  @IsIn(POST_STATUSES)
  status: PostStatusFilter = 'live';

  @IsOptional()
  @IsUUID()
  authorId?: string;

  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  pinned?: boolean;
}

export class AdminPostDto {
  id: string;
  author: AdminUserRefDto;
  body: string;
  pinned: boolean;
  likeCount: number;
  commentCount: number;
  deletedAt: Date | null;
  createdAt: Date;
}

export class AdminPostPageDto {
  items: AdminPostDto[];
  total: number;
  page: number;
  pageSize: number;
}

export class AdminCommentDto {
  id: string;
  postId: string;
  author: AdminUserRefDto;
  body: string;
  deletedAt: Date | null;
  createdAt: Date;
}

export class AdminCommentPageDto {
  items: AdminCommentDto[];
  total: number;
  page: number;
  pageSize: number;
}

export class UpdatePostDto {
  /** Pinned posts are shown first in the app's feed. */
  @IsBoolean()
  pinned: boolean;
}
