import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

import { PageInfoDto, PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { genderEnum } from '../../../database/schema';
import type { Gender } from '../../../database/schema';
import { PersonDto } from '../../people/dto/person.dto';

/** The chips on the home tab. */
export const DISCOVER_FILTERS = ['all', 'new', 'online', 'nearby', 'verified'] as const;
export type DiscoverFilter = (typeof DISCOVER_FILTERS)[number];

const int = () => Type(() => Number);

export class DiscoverQueryDto extends PaginationQueryDto {
  /** Quick filter chip. `nearby` needs coordinates on my profile. */
  @IsOptional()
  @IsIn(DISCOVER_FILTERS)
  filter: DiscoverFilter = 'all';

  @IsOptional()
  @IsIn(genderEnum.enumValues)
  gender?: Gender;

  @IsOptional()
  @int()
  @IsInt()
  @Min(1)
  @Max(20000)
  maxDistanceKm?: number;

  @IsOptional()
  @int()
  @IsInt()
  @Min(18)
  @Max(120)
  minAge?: number;

  @IsOptional()
  @int()
  @IsInt()
  @Min(18)
  @Max(120)
  maxAge?: number;

  /** Pro only. */
  @IsOptional()
  @int()
  @IsInt()
  @Min(100)
  @Max(250)
  minHeightCm?: number;

  /** Pro only. */
  @IsOptional()
  @int()
  @IsInt()
  @Min(100)
  @Max(250)
  maxHeightCm?: number;

  /** Pro only. Exact city match, case-insensitive. */
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(80)
  city?: string;

  /** Pro only. Minimum length of the long bio. */
  @IsOptional()
  @int()
  @IsInt()
  @Min(1)
  @Max(3000)
  minBioLength?: number;

  /** Only people who share this interest. */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  interest?: string;
}

export class PeoplePageDto {
  items: PersonDto[];
  page: PageInfoDto;
}
