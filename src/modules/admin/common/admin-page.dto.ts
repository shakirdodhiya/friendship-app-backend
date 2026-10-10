import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
/** Query strings arrive as text: maps `"true"` / `"false"` to booleans. */
export const toBool = ({ value }: { value: unknown }) => (value === 'true' ? true : value === 'false' ? false : value);
/** Escapes `%` and `_` so user input is matched literally by ILIKE. */
export const likePattern = (search: string) => `%${search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/** Page-numbered listing for admin tables, which show a total and jump to any page. */
export class AdminPageQueryDto {
  /** 1-based page number. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;

  /** Free-text search; what it matches depends on the endpoint. */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  search?: string;
}

export const offsetOf = (query: AdminPageQueryDto) => (query.page - 1) * query.pageSize;

export function pageOf<T>(items: T[], total: number, query: AdminPageQueryDto) {
  return { items, total, page: query.page, pageSize: query.pageSize };
}

export class AdminUserRefDto {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  avatarTint: string | null;
  photoUrl: string | null;
  verified: boolean;
  suspended: boolean;
  deleted: boolean;
}
