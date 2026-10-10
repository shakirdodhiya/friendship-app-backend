import { ApiProperty } from '@nestjs/swagger';

import { genderEnum, verificationStatusEnum } from '../../../database/schema';
import type { Gender, VerificationStatus } from '../../../database/schema';

export class PhotoDto {
  id: string;
  url: string;
  /** Slot on the 6-slot photo grid, 0-based. */
  position: number;
}

export class WorkDto {
  role: string | null;
  department: string | null;
  /** When true the work details are not shown on the public profile. */
  hidden: boolean;
}

export class LocationDto {
  country: string | null;
  state: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
}

export class AvatarDto {
  /** Avatar studio selection: category → option index, e.g. `{ "Tone": 3, "Hair": 7 }`. */
  @ApiProperty({ type: 'object', additionalProperties: { type: 'integer' } })
  config: Record<string, number>;
  /** Plate colour behind the avatar, e.g. `#c4b5f0`. */
  tint: string | null;
}

/** The signed-in user's own, complete profile. */
export class MeDto {
  id: string;
  /** From Firebase (phone sign-in). */
  phone: string | null;
  /** From Firebase (Google / Apple sign-in). */
  email: string | null;
  /** Firebase sign-in method: `phone`, `google.com`, `apple.com`… */
  authProvider: string | null;
  name: string | null;
  /** ISO date, `YYYY-MM-DD`. */
  birthday: string | null;
  age: number | null;
  @ApiProperty({ enum: genderEnum.enumValues, nullable: true })
  gender: Gender | null;
  @ApiProperty({ enum: genderEnum.enumValues, nullable: true })
  interestedIn: Gender | null;
  heightCm: number | null;
  work: WorkDto;
  location: LocationDto;
  languages: string[];
  zodiac: string | null;
  /** 4-letter MBTI code, e.g. `INFJ`. */
  personality: string | null;
  interests: string[];
  shortBio: string | null;
  longBio: string | null;
  avatar: AvatarDto;
  photos: PhotoDto[];
  @ApiProperty({ enum: verificationStatusEnum.enumValues })
  verificationStatus: VerificationStatus;
  notificationsEnabled: boolean;
  coins: number;
  isPro: boolean;
  proUntil: Date | null;
  /** Maximum open friend chats; `null` means unlimited (Pro). */
  chatCapacity: number | null;
  onboardingCompleted: boolean;
  createdAt: Date;
}
