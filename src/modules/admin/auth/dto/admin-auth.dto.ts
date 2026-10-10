import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, MaxLength } from 'class-validator';

import { AdminDto } from '../../admins/dto/admins.dto';

export class AdminLoginDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @Length(1, 128)
  password: string;
}

export class AdminSessionDto {
  /** Send as `Authorization: Bearer <accessToken>` on every admin request. */
  accessToken: string;
  expiresAt: Date;
  admin: AdminDto;
}

export class ChangePasswordDto {
  @IsString()
  @Length(1, 128)
  currentPassword: string;

  /** 10 to 128 characters. */
  @IsString()
  @Length(10, 128)
  newPassword: string;
}
