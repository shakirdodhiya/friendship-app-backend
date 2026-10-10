import { Body, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';

import { AdminPageQueryDto } from '../common/admin-page.dto';
import { AdminController, CurrentAdmin } from '../common/admin.decorators';
import type { AdminPrincipal } from '../common/types';
import { AdminCommunityService } from './admin-community.service';
import {
  AdminCommentPageDto,
  AdminPostDto,
  AdminPostPageDto,
  AdminPostsQueryDto,
  UpdatePostDto,
} from './dto/admin-community.dto';

@AdminController('posts', 'Community')
export class AdminCommunityController {
  constructor(private readonly community: AdminCommunityService) {}

  @Get()
  @ApiOperation({ summary: 'Community posts', description: '`search` matches the post body.' })
  list(@Query() query: AdminPostsQueryDto): Promise<AdminPostPageDto> {
    return this.community.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'One post, deleted or not' })
  get(@Param('id', ParseUUIDPipe) id: string): Promise<AdminPostDto> {
    return this.community.get(id);
  }

  @Get(':id/comments')
  @ApiOperation({ summary: 'Comments on a post, deleted ones included' })
  comments(@Param('id', ParseUUIDPipe) id: string, @Query() query: AdminPageQueryDto): Promise<AdminCommentPageDto> {
    return this.community.comments(id, query);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Pin or unpin a post' })
  update(
    @CurrentAdmin() admin: AdminPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePostDto,
  ): Promise<AdminPostDto> {
    return this.community.setPinned(admin, id, dto.pinned);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove a post from the feed', description: 'Soft delete; it can be restored.' })
  remove(@CurrentAdmin() admin: AdminPrincipal, @Param('id', ParseUUIDPipe) id: string): Promise<AdminPostDto> {
    return this.community.remove(admin, id);
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restore a removed post' })
  restore(@CurrentAdmin() admin: AdminPrincipal, @Param('id', ParseUUIDPipe) id: string): Promise<AdminPostDto> {
    return this.community.restore(admin, id);
  }

  @Delete(':id/comments/:commentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a comment' })
  removeComment(
    @CurrentAdmin() admin: AdminPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
  ): Promise<void> {
    return this.community.removeComment(admin, id, commentId);
  }
}
