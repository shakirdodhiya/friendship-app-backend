import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PaginationQueryDto {
  /** Page size. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 20;

  /** Number of items to skip. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset: number = 0;
}

export class PageInfoDto {
  limit: number;
  offset: number;
  /** True when another page can be requested with `offset + limit`. */
  hasMore: boolean;
}

/** Fetch `limit + 1` rows, then pass them here to trim the extra one and compute `hasMore`. */
export function toPage<T>(rows: T[], query: { limit: number; offset: number }) {
  const hasMore = rows.length > query.limit;
  return {
    items: hasMore ? rows.slice(0, query.limit) : rows,
    page: { limit: query.limit, offset: query.offset, hasMore } satisfies PageInfoDto,
  };
}
