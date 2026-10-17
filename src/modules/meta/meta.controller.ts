import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import {
  AVATAR_CATEGORIES,
  AVATAR_OPTIONS_PER_CATEGORY,
  DEPARTMENTS,
  GENDERS,
  INTERESTS,
  isPremiumAvatarOption,
  LANGUAGES,
  PERSONALITIES,
  PROFILE_LIMITS,
  ROLES,
  ZODIACS,
} from '../../common/constants/catalog';
import { Public } from '../../common/decorators/public.decorator';
import { AppConfig } from '../../config/app-config.service';
import { reportReasonEnum } from '../../database/schema';
import { AppOptionsDto } from './dto/meta.dto';

@ApiTags('Meta')
@Controller('meta')
export class MetaController {
  constructor(private readonly config: AppConfig) { }

  @Public()
  @Get('options')
  @ApiOperation({ summary: 'Picker options, limits and prices (no auth needed)' })
  options(): AppOptionsDto {
    const indexes = Array.from({ length: AVATAR_OPTIONS_PER_CATEGORY }, (_, i) => i);
    return {
      genders: [...GENDERS],
      languages: [...LANGUAGES],
      zodiacs: [...ZODIACS],
      personalities: PERSONALITIES.map((p) => ({ ...p })),
      roles: [...ROLES],
      departments: [...DEPARTMENTS],
      interests: [...INTERESTS],
      reportReasons: [...reportReasonEnum.enumValues],
      avatar: {
        categories: [...AVATAR_CATEGORIES],
        optionsPerCategory: AVATAR_OPTIONS_PER_CATEGORY,
        premium: Object.fromEntries(
          AVATAR_CATEGORIES.map((c) => [c, indexes.filter((i) => isPremiumAvatarOption(c, i))]),
        ),
      },
      limits: {
        minAge: PROFILE_LIMITS.minAge,
        nameMin: PROFILE_LIMITS.name.min,
        nameMax: PROFILE_LIMITS.name.max,
        minInterests: PROFILE_LIMITS.minInterests,
        maxInterests: PROFILE_LIMITS.maxInterests,
        shortBioMin: PROFILE_LIMITS.shortBio.min,
        shortBioMax: PROFILE_LIMITS.shortBio.max,
        longBioMin: PROFILE_LIMITS.longBio.min,
        longBioMax: PROFILE_LIMITS.longBio.max,
        maxLanguages: PROFILE_LIMITS.maxLanguages,
        photoSlots: PROFILE_LIMITS.photoSlots,
        maxUploadMb: this.config.get('MAX_UPLOAD_MB'),
      },
      pricing: {
        quickMatchCost: this.config.get('QUICK_MATCH_COST'),
        quickMatchDurationSeconds: this.config.get('QUICK_MATCH_DURATION_SECONDS'),
        avatarPremiumCost: this.config.get('AVATAR_PREMIUM_COST'),
        freeChatCapacity: this.config.get('FREE_CHAT_CAPACITY'),
      },
    };
  }
}