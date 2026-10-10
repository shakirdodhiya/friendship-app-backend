import type { User, UserPhoto } from '../../database/schema';
import type { MeDto, PhotoDto } from './dto/me.dto';

export const isProActive = (user: Pick<User, 'proUntil'>, now = new Date()) =>
  !!user.proUntil && user.proUntil > now;

/** Whole years between an ISO birthday and today. */
export function ageFrom(birthday: string | null, now = new Date()): number | null {
  if (!birthday) return null;
  const [y, m, d] = birthday.split('-').map(Number);
  let age = now.getUTCFullYear() - y;
  const beforeBirthday = now.getUTCMonth() + 1 < m || (now.getUTCMonth() + 1 === m && now.getUTCDate() < d);
  if (beforeBirthday) age -= 1;
  return age;
}

export const toPhotoDto = (photo: UserPhoto): PhotoDto => ({
  id: photo.id,
  url: photo.url,
  position: photo.position,
});

export function toMeDto(user: User, photos: UserPhoto[], freeChatCapacity: number): MeDto {
  const isPro = isProActive(user);
  return {
    id: user.id,
    phone: user.phone,
    email: user.email,
    authProvider: user.authProvider,
    name: user.name,
    birthday: user.birthday,
    age: ageFrom(user.birthday),
    gender: user.gender,
    interestedIn: user.interestedIn,
    heightCm: user.heightCm,
    work: { role: user.jobRole, department: user.jobDepartment, hidden: user.hideWork },
    location: {
      country: user.country,
      state: user.state,
      city: user.city,
      latitude: user.latitude,
      longitude: user.longitude,
    },
    languages: user.languages,
    zodiac: user.zodiac,
    personality: user.personality,
    interests: user.interests,
    shortBio: user.shortBio,
    longBio: user.longBio,
    avatar: { config: user.avatar, tint: user.avatarTint },
    photos: photos.map(toPhotoDto),
    verificationStatus: user.verificationStatus,
    notificationsEnabled: user.notificationsEnabled,
    coins: user.coinBalance,
    isPro,
    proUntil: user.proUntil,
    chatCapacity: isPro ? null : freeChatCapacity,
    onboardingCompleted: user.onboardingCompletedAt !== null,
    createdAt: user.createdAt,
  };
}
