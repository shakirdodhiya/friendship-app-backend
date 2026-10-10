import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, Length } from 'class-validator';

import { PageInfoDto, PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { PersonSummaryDto } from '../../people/dto/person.dto';

export const POST_SORTS = ['new', 'top', 'unanswered'] as const;
export type PostSort = (typeof POST_SORTS)[number];

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class PostAuthorDto extends PersonSummaryDto {
  /** Chips next to the name, e.g. `["INFJ", "Aries"]`. */
  tags: string[];
}

export class PostDto {
  id: string;
  author: PostAuthorDto;
  body: string;
  /** Pinned posts (e.g. the founder's note) always come first. */
  pinned: boolean;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  mine: boolean;
  createdAt: Date;
}

export class PostPageDto {
  items: PostDto[];
  page: PageInfoDto;
}

export class CommentDto {
  id: string;
  postId: string;
  author: PostAuthorDto;
  body: string;
  mine: boolean;
  createdAt: Date;
}

export class CommentPageDto {
  items: CommentDto[];
  page: PageInfoDto;
}

export class PostsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(POST_SORTS)
  sort: PostSort = 'new';
}

export class CreatePostDto {
  @Transform(trim)
  @IsString()
  @Length(1, 2000)
  body: string;
}

export class CreateCommentDto {
  @Transform(trim)
  @IsString()
  @Length(1, 1000)
  body: string;
}

export class PostLikeResultDto {
  liked: boolean;
  likeCount: number;
}
