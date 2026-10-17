/**
 * Option lists shared with the mobile app (src/data/onboarding.ts there).
 * Profile fields are validated against these so the server and the pickers never drift.
 */

// genders people can pick, the DB enum allows more so adding one here needs no migration
export const GENDERS = ['male', 'female'] as const;

export const LANGUAGES = [
  'Hindi', 'English', 'Marathi', 'Telugu', 'Tamil', 'Kannada', 'Bengali', 'Gujarati', 'Malayalam',
  'Punjabi', 'Spanish', 'French', 'German', 'Japanese', 'Korean', 'Portuguese',
] as const;

export const ZODIACS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
] as const;

/** Stored as the 4-letter code; the label is for display. */
export const PERSONALITIES = [
  { code: 'INFJ', label: 'The Advocate' }, { code: 'INFP', label: 'The Mediator' },
  { code: 'INTJ', label: 'The Architect' }, { code: 'INTP', label: 'The Logician' },
  { code: 'ENFJ', label: 'The Protagonist' }, { code: 'ENFP', label: 'The Campaigner' },
  { code: 'ENTJ', label: 'The Commander' }, { code: 'ENTP', label: 'The Debater' },
  { code: 'ISFJ', label: 'The Defender' }, { code: 'ISFP', label: 'The Adventurer' },
  { code: 'ISTJ', label: 'The Logistician' }, { code: 'ISTP', label: 'The Virtuoso' },
  { code: 'ESFJ', label: 'The Consul' }, { code: 'ESFP', label: 'The Entertainer' },
  { code: 'ESTJ', label: 'The Executive' }, { code: 'ESTP', label: 'The Entrepreneur' },
] as const;
export const PERSONALITY_CODES = PERSONALITIES.map((p) => p.code);

export const ROLES = [
  'Doctor', 'Engineer', 'Designer', 'Teacher', 'Founder', 'Student',
  'Nurse', 'Lawyer', 'Chef', 'Artist', 'Analyst', 'Other',
] as const;

export const DEPARTMENTS = [
  'Healthcare', 'Engineering', 'Design', 'Education', 'Finance', 'Legal',
  'Hospitality', 'Marketing', 'Operations', 'Research', 'Sales', 'Other',
] as const;

export const INTERESTS = [
  'Singing', 'Reading', 'Swimming', 'Books', 'Anime', 'Series', 'Philosophy',
  'Meditation', 'Outing', 'Adventure', 'Cooking', 'Stitching', 'Crochet',
  'Business', 'Hiking', 'Programming', 'Baking', 'Fitness', 'Gym', 'Dancing',
  'Calisthenics', 'Travel', 'Photography', 'Cinema', 'Coffee', 'Gaming',
  'Yoga', 'Art', 'Music', 'Workout',
] as const;

export const AVATAR_CATEGORIES = [
  'Tone', 'Face', 'Hair', 'Eyes', 'Mouth', 'Beard', 'Clothes', 'Hat', 'Extra premium', 'Banner',
] as const;
export const AVATAR_OPTIONS_PER_CATEGORY = 12;
/** Every third option is paid, matching how the avatar studio grid is drawn. */
export const isPremiumAvatarOption = (category: string, index: number) =>
  category === 'Extra premium' || index % 3 === 1;

export const PROFILE_LIMITS = {
  minAge: 18,
  name: { min: 2, max: 50 }, // full name
  minInterests: 5,
  maxInterests: 15,
  shortBio: { min: 50, max: 125 },
  longBio: { min: 125, max: 3000 },
  maxLanguages: 10,
  photoSlots: 6,
  topMatchedInterests: 3,
} as const;

export const PRESENCE = {
  /** A user counts as online if a socket is open or they made a request this recently. */
  onlineWindowSeconds: 120,
  /** "New here" filter on discover. */
  newUserDays: 14,
  /** Distance of the "Nearby" filter. */
  nearbyKm: 15,
} as const;