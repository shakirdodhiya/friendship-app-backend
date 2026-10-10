import { ApiProperty } from '@nestjs/swagger';

import { genderEnum } from '../../../database/schema';
import type { Gender } from '../../../database/schema';
import { AvatarDto, PhotoDto } from '../../users/dto/me.dto';

/** Another user's public profile, as seen by the viewer. */
export class PersonDto {
  id: string;
  name: string;
  age: number | null;
  @ApiProperty({ enum: genderEnum.enumValues, nullable: true })
  gender: Gender | null;
  verified: boolean;
  pro: boolean;
  /** Has an open socket or made a request in the last two minutes. */
  online: boolean;
  lastActiveAt: Date;
  /** City, else state, else country. */
  location: string | null;
  /** Null when the user hid their work details. */
  job: string | null;
  heightCm: number | null;
  /** Null when either side has not shared coordinates. */
  distanceKm: number | null;
  zodiac: string | null;
  personality: string | null;
  languages: string[];
  shortBio: string | null;
  longBio: string | null;
  interests: string[];
  /** Up to three interests shared with the viewer ("Top 3 Matched"). */
  topMatched: string[];
  avatar: AvatarDto;
  /** Photos unlock once the two of you are friends (share an open chat). */
  photosLocked: boolean;
  photos: PhotoDto[];
  likedByMe: boolean;
  likesMe: boolean;
  /** Open friend chat with the viewer, if any. */
  chatId: string | null;
  joinedAt: Date;
}

/** Compact identity used inside chats, posts and quick matches. */
export class PersonSummaryDto {
  id: string;
  name: string;
  avatar: AvatarDto;
  verified: boolean;
  pro: boolean;
  online: boolean;
}
