import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';

import { adminRoleEnum, type AdminRole } from '../../../../database/schema';
import { trim } from '../../common/admin-page.dto';

const lower = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);

export class AdminDto {
  id: string;
  email: string;
  name: string;
  @ApiProperty({ enum: adminRoleEnum.enumValues })
  role: AdminRole;
  disabled: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}

export class CreateAdminDto {
  @Transform(lower)
  @IsEmail()
  @MaxLength(254)
  email: string;

  @Transform(trim)
  @IsString()
  @Length(1, 100)
  name: string;

  /** 10 to 128 characters. */
  @IsString()
  @Length(10, 128)
  password: string;

  @IsIn(adminRoleEnum.enumValues)
  role: AdminRole;
}

export class UpdateAdminDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  name?: string;

  @IsOptional()
  @IsIn(adminRoleEnum.enumValues)
  role?: AdminRole;

  /** Deactivated admins are signed out and cannot sign in. */
  @IsOptional()
  @IsBoolean()
  disabled?: boolean;

  /** Sets a new password and signs the admin out everywhere. */
  @IsOptional()
  @IsString()
  @Length(10, 128)
  password?: string;
}
