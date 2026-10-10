import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import type { AuthUser } from '../../common/types/auth-user';
import { CommunityService } from './community.service';
import {
  CommentDto,
  CommentPageDto,
  CreateCommentDto,
  CreatePostDto,
  PostDto,
  PostLikeResultDto,
  PostPageDto,
  PostsQueryDto,
} from './dto/community.dto';

@ApiTags('Community')
@ApiBearerAuth()
@Controller('posts')
export class CommunityController {
  constructor(private readonly community: CommunityService) {}

  @Get()
  @ApiOperation({ summary: 'Community feed', description: 'Pinned posts first, then sorted by `new`, `top` or `unanswered`.' })
  list(@CurrentUser() user: AuthUser, @Query() query: PostsQueryDto): Promise<PostPageDto> {
    return this.community.list(user.id, query);
  }

  @Post()
  @ApiOperation({ summary: 'Write a post' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePostDto): Promise<PostDto> {
    return this.community.create(user.id, dto.body);
  }

  @Get(':postId')
  @ApiOperation({ summary: 'One post' })
  get(@CurrentUser() user: AuthUser, @Param('postId', ParseUUIDPipe) postId: string): Promise<PostDto> {
    return this.community.get(user.id, postId);
  }

  @Delete(':postId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete my post' })
  remove(@CurrentUser() user: AuthUser, @Param('postId', ParseUUIDPipe) postId: string): Promise<void> {
    return this.community.remove(user.id, postId);
  }

  @Post(':postId/like')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Like a post' })
  like(@CurrentUser() user: AuthUser, @Param('postId', ParseUUIDPipe) postId: string): Promise<PostLikeResultDto> {
    return this.community.setLike(user.id, postId, true);
  }

  @Delete(':postId/like')
  @ApiOperation({ summary: 'Remove my like from a post' })
  unlike(@CurrentUser() user: AuthUser, @Param('postId', ParseUUIDPipe) postId: string): Promise<PostLikeResultDto> {
    return this.community.setLike(user.id, postId, false);
  }

  @Get(':postId/comments')
  @ApiOperation({ summary: 'Comments on a post, oldest first' })
  comments(
    @CurrentUser() user: AuthUser,
    @Param('postId', ParseUUIDPipe) postId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<CommentPageDto> {
    return this.community.comments(user.id, postId, query);
  }

  @Post(':postId/comments')
  @ApiOperation({ summary: 'Comment on a post' })
  comment(
    @CurrentUser() user: AuthUser,
    @Param('postId', ParseUUIDPipe) postId: string,
    @Body() dto: CreateCommentDto,
  ): Promise<CommentDto> {
    return this.community.addComment(user.id, postId, dto.body);
  }

  @Delete(':postId/comments/:commentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete my comment' })
  removeComment(
    @CurrentUser() user: AuthUser,
    @Param('postId', ParseUUIDPipe) postId: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
  ): Promise<void> {
    return this.community.removeComment(user.id, postId, commentId);
  }
}
