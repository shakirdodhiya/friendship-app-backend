export class PersonalityOptionDto {
  /** Stored value, e.g. `INFJ`. */
  code: string;
  /** e.g. "The Advocate". */
  label: string;
}

export class LimitsDto {
  minAge: number;
  nameMin: number;
  nameMax: number;
  minInterests: number;
  maxInterests: number;
  shortBioMin: number;
  shortBioMax: number;
  longBioMin: number;
  longBioMax: number;
  maxLanguages: number;
  photoSlots: number;
  maxUploadMb: number;
}

export class PricingDto {
  quickMatchCost: number;
  quickMatchDurationSeconds: number;
  avatarPremiumCost: number;
  /** Open friend chats allowed without Pro. */
  freeChatCapacity: number;
}

export class AvatarCatalogDto {
  categories: string[];
  optionsPerCategory: number;
  /** Premium option indexes per category (cost `pricing.avatarPremiumCost` coins each). */
  premium: Record<string, number[]>;
}

/** Everything the onboarding pickers and paywalls need, in one call. */
export class AppOptionsDto {
  genders: string[];
  languages: string[];
  zodiacs: string[];
  personalities: PersonalityOptionDto[];
  roles: string[];
  departments: string[];
  interests: string[];
  countries: string[];
  states: string[];
  cities: string[];
  reportReasons: string[];
  avatar: AvatarCatalogDto;
  limits: LimitsDto;
  pricing: PricingDto;
}
