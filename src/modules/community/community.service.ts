import { Inject, Injectable } from '@nestjs/common';
import { AnyColumn, and, asc, count, desc, eq, isNull, SQL, sql } from 'drizzle-orm';

import { PaginationQueryDto, toPage } from '../../common/dto/pagination.dto';
import { notFound } from '../../common/errors';
import { DB, type Database } from '../../database/database.module';
import { blocks, postComments, postLikes, posts, User, users } from '../../database/schema';
import { PeopleService } from '../people/people.service';
import { UsersService } from '../users/users.service';
import type {
  CommentDto,
  CommentPageDto,
  PostAuthorDto,
  PostDto,
  PostLikeResultDto,
  PostPageDto,
  PostsQueryDto,
} from './dto/community.dto';

const likeCount = sql<number>`(select count(*)::int from ${postLikes} where ${postLikes.postId} = ${posts.id})`;
const commentCount = sql<number>`(select count(*)::int from ${postComments}
  where ${postComments.postId} = ${posts.id} and ${postComments.deletedAt} is null)`;

/** Hides content written by people I blocked or who blocked me. */
const notBlocked = (viewerId: string, authorColumn: AnyColumn) => sql`not exists (
  select 1 from ${blocks}
  where (${blocks.blockerId} = ${viewerId} and ${blocks.blockedId} = ${authorColumn})
     or (${blocks.blockerId} = ${authorColumn} and ${blocks.blockedId} = ${viewerId})
)`;

@Injectable()
export class CommunityService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly users: UsersService,
    private readonly people: PeopleService,
  ) {}

  async list(viewerId: string, query: PostsQueryDto): Promise<PostPageDto> {
    const order: SQL[] = [desc(posts.pinned)];
    if (query.sort === 'top') order.push(desc(likeCount));
    order.push(desc(posts.createdAt), desc(posts.id));

    const conditions = [isNull(posts.deletedAt), notBlocked(viewerId, posts.authorId)];
    if (query.sort === 'unanswered') conditions.push(sql`${commentCount} = 0`);

    const rows = await this.selectPosts(viewerId)
      .where(and(...conditions))
      .orderBy(...order)
      .limit(query.limit + 1)
      .offset(query.offset);
    const page = toPage(rows, query);
    return { items: page.items.map((r) => this.toPostDto(r, viewerId)), page: page.page };
  }

  async create(viewerId: string, body: string): Promise<PostDto> {
    await this.users.assertOnboarded(viewerId);
    const [post] = await this.db.insert(posts).values({ authorId: viewerId, body }).returning({ id: posts.id });
    return this.get(viewerId, post.id);
  }

  async get(viewerId: string, postId: string): Promise<PostDto> {
    const [row] = await this.selectPosts(viewerId).where(
      and(eq(posts.id, postId), isNull(posts.deletedAt), notBlocked(viewerId, posts.authorId)),
    );
    if (!row) throw notFound('Post');
    return this.toPostDto(row, viewerId);
  }

  async remove(viewerId: string, postId: string): Promise<void> {
    const [deleted] = await this.db
      .update(posts)
      .set({ deletedAt: new Date() })
      .where(and(eq(posts.id, postId), eq(posts.authorId, viewerId), isNull(posts.deletedAt)))
      .returning({ id: posts.id });
    if (!deleted) throw notFound('Post');
  }

  async setLike(viewerId: string, postId: string, liked: boolean): Promise<PostLikeResultDto> {
    await this.get(viewerId, postId);
    if (liked) {
      await this.db.insert(postLikes).values({ postId, userId: viewerId }).onConflictDoNothing();
    } else {
      await this.db.delete(postLikes).where(and(eq(postLikes.postId, postId), eq(postLikes.userId, viewerId)));
    }
    const [row] = await this.db.select({ n: count() }).from(postLikes).where(eq(postLikes.postId, postId));
    return { liked, likeCount: row.n };
  }

  async comments(viewerId: string, postId: string, query: PaginationQueryDto): Promise<CommentPageDto> {
    await this.get(viewerId, postId);
    const rows = await this.db
      .select({ comment: postComments, author: users })
      .from(postComments)
      .innerJoin(users, eq(users.id, postComments.authorId))
      .where(
        and(
          eq(postComments.postId, postId),
          isNull(postComments.deletedAt),
          notBlocked(viewerId, postComments.authorId),
        ),
      )
      .orderBy(asc(postComments.createdAt), asc(postComments.id))
      .limit(query.limit + 1)
      .offset(query.offset);
    const page = toPage(rows, query);
    return {
      items: page.items.map((r) => ({
        id: r.comment.id,
        postId: r.comment.postId,
        author: this.toAuthor(r.author),
        body: r.comment.body,
        mine: r.comment.authorId === viewerId,
        createdAt: r.comment.createdAt,
      })),
      page: page.page,
    };
  }

  async addComment(viewerId: string, postId: string, body: string): Promise<CommentDto> {
    const author = await this.users.assertOnboarded(viewerId);
    await this.get(viewerId, postId);
    const [comment] = await this.db.insert(postComments).values({ postId, authorId: viewerId, body }).returning();
    return {
      id: comment.id,
      postId,
      author: this.toAuthor(author),
      body: comment.body,
      mine: true,
      createdAt: comment.createdAt,
    };
  }

  async removeComment(viewerId: string, postId: string, commentId: string): Promise<void> {
    const [deleted] = await this.db
      .update(postComments)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(postComments.id, commentId),
          eq(postComments.postId, postId),
          eq(postComments.authorId, viewerId),
          isNull(postComments.deletedAt),
        ),
      )
      .returning({ id: postComments.id });
    if (!deleted) throw notFound('Comment');
  }

  private selectPosts(viewerId: string) {
    return this.db
      .select({
        post: posts,
        author: users,
        likeCount,
        commentCount,
        likedByMe: sql<boolean>`exists (select 1 from ${postLikes}
          where ${postLikes.postId} = ${posts.id} and ${postLikes.userId} = ${viewerId})`,
      })
      .from(posts)
      .innerJoin(users, eq(users.id, posts.authorId))
      .$dynamic();
  }

  private toPostDto(
    row: { post: typeof posts.$inferSelect; author: User; likeCount: number; commentCount: number; likedByMe: boolean },
    viewerId: string,
  ): PostDto {
    return {
      id: row.post.id,
      author: this.toAuthor(row.author),
      body: row.post.body,
      pinned: row.post.pinned,
      likeCount: row.likeCount,
      commentCount: row.commentCount,
      likedByMe: row.likedByMe,
      mine: row.post.authorId === viewerId,
      createdAt: row.post.createdAt,
    };
  }

  private toAuthor(user: User): PostAuthorDto {
    const tags = user.deletedAt ? [] : [user.personality, user.zodiac].filter((t): t is string => !!t);
    return { ...this.people.toSummary(user), tags };
  }
}
