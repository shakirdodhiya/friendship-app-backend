import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

import { AdminPageQueryDto } from '../../common/admin-page.dto';

export class AuditQueryDto extends AdminPageQueryDto {
  @IsOptional()
  @IsUUID()
  adminId?: string;

  /** e.g. `user`, `post`, `report`. */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  targetType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  targetId?: string;
}

export class AuditLogDto {
  id: string;
  admin: { id: string; name: string; email: string } | null;
  action: string;
  targetType: string;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export class AuditLogPageDto {
  items: AuditLogDto[];
  total: number;
  page: number;
  pageSize: number;
}
