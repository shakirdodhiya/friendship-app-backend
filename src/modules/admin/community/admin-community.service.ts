import { Inject, Injectable } from '@nestjs/common';
import { and, asc, count, desc, eq, ilike, isNotNull, isNull, SQL, sql } from 'drizzle-orm';

import { notFound } from '../../../common/errors';
import { DB, type Database } from '../../../database/database.module';
import { postComments, postLikes, posts, users } from '../../../database/schema';
import { AdminPageQueryDto, likePattern, offsetOf, pageOf } from '../common/admin-page.dto';
import { AuditService } from '../common/audit.service';
import type { AdminPrincipal } from '../common/types';
import { userRefColumns } from '../common/user-ref';
import type {
  AdminCommentPageDto,
  AdminPostDto,
  AdminPostPageDto,
  AdminPostsQueryDto,
} from './dto/admin-community.dto';

const likeCount = sql<number>`(select count(*)::int from ${postLikes} where ${postLikes.postId} = ${posts.id})`;
const commentCount = sql<number>`(select count(*)::int from ${postComments}
  where ${postComments.postId} = ${posts.id} and ${postComments.deletedAt} is null)`;

@Injectable()
export class AdminCommunityService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly audit: AuditService,
  ) {}

  async list(query: AdminPostsQueryDto): Promise<AdminPostPageDto> {
    const conditions: SQL[] = [];
    if (query.status === 'live') conditions.push(isNull(posts.deletedAt));
    if (query.status === 'deleted') conditions.push(isNotNull(posts.deletedAt));
    if (query.authorId) conditions.push(eq(posts.authorId, query.authorId));
    if (query.pinned !== undefined) conditions.push(eq(posts.pinned, query.pinned));
    if (query.search) conditions.push(ilike(posts.body, likePattern(query.search)));
    const where = and(...conditions);

    const [rows, [{ total }]] = await Promise.all([
      this.selectPosts().where(where).orderBy(desc(posts.createdAt), desc(posts.id)).limit(query.pageSize).offset(offsetOf(query)),
      this.db.select({ total: count() }).from(posts).where(where),
    ]);
    return pageOf(rows, total, query);
  }

  async get(postId: string): Promise<AdminPostDto> {
    const [row] = await this.selectPosts().where(eq(posts.id, postId));
    if (!row) throw notFound('Post');
    return row;
  }

  /** Every comment on the post, deleted ones included, oldest first. */
  async comments(postId: string, query: AdminPageQueryDto): Promise<AdminCommentPageDto> {
    await this.get(postId);
    const where = eq(postComments.postId, postId);
    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select({
          id: postComments.id,
          postId: postComments.postId,
          author: userRefColumns(users),
          body: postComments.body,
          deletedAt: postComments.deletedAt,
          createdAt: postComments.createdAt,
        })
        .from(postComments)
        .innerJoin(users, eq(users.id, postComments.authorId))
        .where(where)
        .orderBy(asc(postComments.createdAt))
        .limit(query.pageSize)
        .offset(offsetOf(query)),
      this.db.select({ total: count() }).from(postComments).where(where),
    ]);
    return pageOf(rows, total, query);
  }

  async setPinned(actor: AdminPrincipal, postId: string, pinned: boolean): Promise<AdminPostDto> {
    await this.mutatePost(actor, postId, { pinned }, pinned ? 'post.pin' : 'post.unpin');
    return this.get(postId);
  }

  async remove(actor: AdminPrincipal, postId: string): Promise<AdminPostDto> {
    await this.mutatePost(actor, postId, { deletedAt: new Date() }, 'post.delete');
    return this.get(postId);
  }

  async restore(actor: AdminPrincipal, postId: string): Promise<AdminPostDto> {
    await this.mutatePost(actor, postId, { deletedAt: null }, 'post.restore');
    return this.get(postId);
  }

  async removeComment(actor: AdminPrincipal, postId: string, commentId: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [deleted] = await tx
        .update(postComments)
        .set({ deletedAt: new Date() })
        .where(and(eq(postComments.id, commentId), eq(postComments.postId, postId), isNull(postComments.deletedAt)))
        .returning({ authorId: postComments.authorId, body: postComments.body });
      if (!deleted) throw notFound('Comment');
      await this.audit.record(
        actor,
        { action: 'comment.delete', targetType: 'comment', targetId: commentId, metadata: { postId, ...deleted } },
        tx,
      );
    });
  }

  private async mutatePost(
    actor: AdminPrincipal,
    postId: string,
    changes: Partial<typeof posts.$inferInsert>,
    action: string,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(posts)
        .set(changes)
        .where(eq(posts.id, postId))
        .returning({ authorId: posts.authorId });
      if (!updated) throw notFound('Post');
      await this.audit.record(actor, { action, targetType: 'post', targetId: postId, metadata: { authorId: updated.authorId } }, tx);
    });
  }

  private selectPosts() {
    return this.db
      .select({
        id: posts.id,
        author: userRefColumns(users),
        body: posts.body,
        pinned: posts.pinned,
        likeCount,
        commentCount,
        deletedAt: posts.deletedAt,
        createdAt: posts.createdAt,
      })
      .from(posts)
      .innerJoin(users, eq(users.id, posts.authorId))
      .$dynamic();
  }
}
