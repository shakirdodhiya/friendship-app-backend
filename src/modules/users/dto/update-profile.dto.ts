import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsHexColor,
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsObject,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { Nullable, Optional } from '../../../common/decorators/optional.decorator';
import {
  DEPARTMENTS,
  INTERESTS,
  LANGUAGES,
  PERSONALITY_CODES,
  PROFILE_LIMITS,
  ROLES,
  ZODIACS,
} from '../../../common/constants/catalog';
import { genderEnum } from '../../../database/schema';
import type { Gender } from '../../../database/schema';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/**
 * Every onboarding step and every row on the profile tab saves through this one DTO.
 * Send only the fields that changed; send `null` to clear an optional field.
 */
export class UpdateProfileDto {
  @Optional()
  @Transform(trim)
  @IsString()
  @Length(2, 50)
  name?: string;

  /** ISO date, `YYYY-MM-DD`. Must be at least 18 years ago. */
  @Optional()
  @IsDateString({ strict: true })
  birthday?: string;

  /** @example "female" */
  @Optional()
  @IsIn(genderEnum.enumValues)
  gender?: Gender;

  @Nullable()
  @IsIn(genderEnum.enumValues)
  interestedIn?: Gender | null;

  @Nullable()
  @IsInt()
  @Min(100)
  @Max(250)
  heightCm?: number | null;

  @Nullable()
  @IsIn(ROLES)
  jobRole?: string | null;

  @Nullable()
  @IsIn(DEPARTMENTS)
  jobDepartment?: string | null;

  @Optional()
  @IsBoolean()
  hideWork?: boolean;

  @Nullable()
  @Transform(trim)
  @IsString()
  @MaxLength(80)
  country?: string | null;

  @Nullable()
  @Transform(trim)
  @IsString()
  @MaxLength(80)
  state?: string | null;

  @Nullable()
  @Transform(trim)
  @IsString()
  @MaxLength(80)
  city?: string | null;

  /** Used for distance and the "Nearby" filter. Send together with `longitude`. */
  @Nullable()
  @IsLatitude()
  latitude?: number | null;

  @Nullable()
  @IsLongitude()
  longitude?: number | null;

  @Optional()
  @IsArray()
  @ArrayMaxSize(PROFILE_LIMITS.maxLanguages)
  @ArrayUnique()
  @IsIn(LANGUAGES, { each: true })
  languages?: string[];

  @Nullable()
  @IsIn(ZODIACS)
  zodiac?: string | null;

  /** 4-letter MBTI code, e.g. `INFJ`. */
  @Nullable()
  @IsIn(PERSONALITY_CODES)
  personality?: string | null;

  @Optional()
  @IsArray()
  @ArrayMinSize(PROFILE_LIMITS.minInterests)
  @ArrayMaxSize(PROFILE_LIMITS.maxInterests)
  @ArrayUnique()
  @IsIn(INTERESTS, { each: true })
  interests?: string[];

  @Nullable()
  @Transform(trim)
  @IsString()
  @Length(PROFILE_LIMITS.shortBio.min, PROFILE_LIMITS.shortBio.max)
  shortBio?: string | null;

  @Nullable()
  @Transform(trim)
  @IsString()
  @Length(PROFILE_LIMITS.longBio.min, PROFILE_LIMITS.longBio.max)
  longBio?: string | null;

  @Optional()
  @IsBoolean()
  notificationsEnabled?: boolean;
}

export class UpdateAvatarDto {
  /** Category → option index. Unowned premium options are bought with coins as part of this call. */
  @IsObject()
  config: Record<string, number>;

  @Nullable()
  @IsHexColor()
  tint?: string | null;
}

export class AvatarUpdateResultDto {
  config: Record<string, number>;
  tint: string | null;
  /** Coins charged for premium options bought by this update. */
  coinsSpent: number;
  coins: number;
}

export class OwnedAvatarItemDto {
  category: string;
  optionIndex: number;
}

export class UploadPhotoDto {
  /** Grid slot to fill (0–5). Replaces whatever photo is already there. */
  @Transform(({ value }) => (value === undefined ? value : Number(value)))
  @IsInt()
  @Min(0)
  @Max(PROFILE_LIMITS.photoSlots - 1)
  position: number;
}

export class VerificationStatusDto {
  /** @example "pending" */
  status: string;
}
