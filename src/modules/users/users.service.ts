import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';

import {
  AVATAR_CATEGORIES,
  AVATAR_OPTIONS_PER_CATEGORY,
  isPremiumAvatarOption,
  PROFILE_LIMITS,
} from '../../common/constants/catalog';
import { AppException, badRequest, ErrorCode, notFound } from '../../common/errors';
import { AppConfig } from '../../config/app-config.service';
import { DB, type Database } from '../../database/database.module';
import {
  avatarItems,
  chats,
  chatParticipants,
  NewUser,
  quickMatches,
  User,
  userPhotos,
  users,
  verificationRequests,
} from '../../database/schema';
import { FirebaseService } from '../firebase/firebase.service';
import { LocationsService } from '../locations/locations.service';
import { StorageService } from '../storage/storage.service';
import { WalletLedgerService } from '../wallet/wallet-ledger.service';
import type { MeDto, PhotoDto } from './dto/me.dto';
import type {
  AvatarUpdateResultDto,
  OwnedAvatarItemDto,
  UpdateAvatarDto,
  UpdateProfileDto,
  VerificationStatusDto,
} from './dto/update-profile.dto';
import { ageFrom, toMeDto, toPhotoDto } from './users.mapper';

@Injectable()
export class UsersService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly config: AppConfig,
    private readonly storage: StorageService,
    private readonly ledger: WalletLedgerService,
    private readonly firebase: FirebaseService,
    private readonly locations: LocationsService,
  ) {}

  /** A live (not deleted) user, or 404. */
  async findActive(userId: string): Promise<User> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.id, userId), isNull(users.deletedAt)));
    if (!user) throw notFound('User');
    return user;
  }

  /** Guards features that need a finished profile (chatting, posting, quick match). */
  async assertOnboarded(userId: string): Promise<User> {
    const user = await this.findActive(userId);
    if (!user.onboardingCompletedAt) {
      throw new AppException(HttpStatus.FORBIDDEN, ErrorCode.ONBOARDING_INCOMPLETE, 'Finish setting up your profile first');
    }
    return user;
  }

  async getMe(userId: string): Promise<MeDto> {
    const user = await this.findActive(userId);
    const photos = await this.db
      .select()
      .from(userPhotos)
      .where(eq(userPhotos.userId, userId))
      .orderBy(asc(userPhotos.position));
    return toMeDto(user, photos, this.config.get('FREE_CHAT_CAPACITY'));
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<MeDto> {
    if (dto.birthday !== undefined) {
      const age = ageFrom(dto.birthday);
      if (age === null || age < PROFILE_LIMITS.minAge) {
        throw badRequest(`You must be at least ${PROFILE_LIMITS.minAge} to use the app`);
      }
      if (age > 120) throw badRequest('Birthday is not valid');
    }
    if ((dto.latitude === undefined) !== (dto.longitude === undefined)) {
      throw badRequest('latitude and longitude must be sent together');
    }

    // DTO keys map 1:1 onto columns; whitelisting in the ValidationPipe drops anything else.
    const patch: Partial<NewUser> = { ...dto };
    if (dto.country !== undefined || dto.state !== undefined || dto.city !== undefined) {
      Object.assign(patch, await this.checkedPlace(userId, dto));
    }
    if (Object.keys(patch).length > 0) {
      await this.db.update(users).set(patch).where(eq(users.id, userId));
    }
    return this.getMe(userId);
  }

  /**
   * Country, state and city are saved together: all empty to clear them, or all three from our
   * location list. Fields that were not sent keep the saved value. Stores the list's spelling.
   */
  private async checkedPlace(userId: string, dto: UpdateProfileDto) {
    const current = await this.findActive(userId);
    const country = (dto.country !== undefined ? dto.country : current.country) || null;
    const state = (dto.state !== undefined ? dto.state : current.state) || null;
    const city = (dto.city !== undefined ? dto.city : current.city) || null;

    if (!country && !state && !city) return { country: null, state: null, city: null };
    if (!country || !state || !city) throw badRequest('Send country, state and city together');

    const place = await this.locations.resolve(country, state, city);
    if (!place) throw badRequest('That country, state and city combination is not in our list');
    return place;
  }

  async completeOnboarding(userId: string): Promise<MeDto> {
    const user = await this.findActive(userId);
    const missing: string[] = [];
    if (!user.name) missing.push('name');
    if (!user.birthday) missing.push('birthday');
    if (!user.gender) missing.push('gender');
    if (user.interests.length < PROFILE_LIMITS.minInterests) missing.push('interests');
    if (!user.shortBio) missing.push('shortBio');
    if (missing.length > 0) {
      throw new AppException(HttpStatus.BAD_REQUEST, ErrorCode.ONBOARDING_INCOMPLETE, 'Profile is missing required fields', {
        missing,
      });
    }
    if (!user.onboardingCompletedAt) {
      await this.db.update(users).set({ onboardingCompletedAt: new Date() }).where(eq(users.id, userId));
    }
    return this.getMe(userId);
  }

  async listAvatarItems(userId: string): Promise<OwnedAvatarItemDto[]> {
    return this.db
      .select({ category: avatarItems.category, optionIndex: avatarItems.optionIndex })
      .from(avatarItems)
      .where(eq(avatarItems.userId, userId));
  }

  /** Saves the avatar and buys any premium options in it the user does not own yet — all or nothing. */
  async updateAvatar(userId: string, dto: UpdateAvatarDto): Promise<AvatarUpdateResultDto> {
    const entries = Object.entries(dto.config);
    for (const [category, index] of entries) {
      if (!(AVATAR_CATEGORIES as readonly string[]).includes(category)) {
        throw badRequest(`Unknown avatar category "${category}"`);
      }
      if (!Number.isInteger(index) || index < 0 || index >= AVATAR_OPTIONS_PER_CATEGORY) {
        throw badRequest(`Avatar option for "${category}" must be an integer from 0 to ${AVATAR_OPTIONS_PER_CATEGORY - 1}`);
      }
    }

    return this.db.transaction(async (tx) => {
      const owned = await tx
        .select({ category: avatarItems.category, optionIndex: avatarItems.optionIndex })
        .from(avatarItems)
        .where(eq(avatarItems.userId, userId));
      const ownedKeys = new Set(owned.map((o) => `${o.category}:${o.optionIndex}`));
      const toBuy = entries.filter(
        ([category, index]) => isPremiumAvatarOption(category, index) && !ownedKeys.has(`${category}:${index}`),
      );

      const cost = toBuy.length * this.config.get('AVATAR_PREMIUM_COST');
      let coins = await this.ledger.balance(tx, userId);
      if (toBuy.length > 0) {
        coins = await this.ledger.apply(tx, {
          userId,
          amount: -cost,
          type: 'avatar_item',
          metadata: { items: toBuy.map(([category, optionIndex]) => ({ category, optionIndex })) },
        });
        await tx
          .insert(avatarItems)
          .values(toBuy.map(([category, optionIndex]) => ({ userId, category, optionIndex })))
          .onConflictDoNothing();
      }

      const [updated] = await tx
        .update(users)
        .set({ avatar: dto.config, ...(dto.tint !== undefined ? { avatarTint: dto.tint } : {}) })
        .where(eq(users.id, userId))
        .returning({ avatar: users.avatar, tint: users.avatarTint });

      return { config: updated.avatar, tint: updated.tint, coinsSpent: cost, coins };
    });
  }

  async uploadPhoto(userId: string, file: Express.Multer.File | undefined, position: number): Promise<PhotoDto> {
    const url = await this.storage.saveImage(file, `photos/${userId}`);
    const replaced = await this.db.transaction(async (tx) => {
      const [previous] = await tx
        .delete(userPhotos)
        .where(and(eq(userPhotos.userId, userId), eq(userPhotos.position, position)))
        .returning();
      const [photo] = await tx.insert(userPhotos).values({ userId, url, position }).returning();
      return { previous, photo };
    });
    if (replaced.previous) await this.storage.remove(replaced.previous.url);
    return toPhotoDto(replaced.photo);
  }

  async deletePhoto(userId: string, photoId: string): Promise<void> {
    const [photo] = await this.db
      .delete(userPhotos)
      .where(and(eq(userPhotos.id, photoId), eq(userPhotos.userId, userId)))
      .returning();
    if (!photo) throw notFound('Photo');
    await this.storage.remove(photo.url);
  }

  async submitVerification(userId: string, file: Express.Multer.File | undefined): Promise<VerificationStatusDto> {
    const selfieUrl = await this.storage.saveImage(file, `verification/${userId}`);
    // Without a reviewer in place, development can approve straight away.
    const status = this.config.get('VERIFICATION_AUTO_APPROVE') ? 'verified' : 'pending';
    await this.db.transaction(async (tx) => {
      await tx.insert(verificationRequests).values({
        userId,
        selfieUrl,
        status,
        reviewedAt: status === 'verified' ? new Date() : null,
      });
      await tx.update(users).set({ verificationStatus: status }).where(eq(users.id, userId));
    });
    return { status };
  }

  /**
   * Soft-deletes the account: personal data is wiped, open chats are closed and the Firebase user is deleted,
   * so the same phone / Google / Apple login starts a fresh account. Ledger and payment rows are kept for accounting.
   */
  async deleteAccount(userId: string): Promise<void> {
    const user = await this.findActive(userId);
    const photos = await this.db.transaction(async (tx) => {
      const now = new Date();
      await tx
        .update(users)
        .set({
          deletedAt: now,
          firebaseUid: null,
          phone: null,
          email: null,
          name: null,
          birthday: null,
          shortBio: null,
          longBio: null,
          latitude: null,
          longitude: null,
          notificationsEnabled: false,
        })
        .where(eq(users.id, userId));

      const memberOf = tx
        .select({ id: chatParticipants.chatId })
        .from(chatParticipants)
        .where(eq(chatParticipants.userId, userId));
      await tx.update(chats).set({ closedAt: now }).where(and(inArray(chats.id, memberOf), isNull(chats.closedAt)));
      await tx
        .update(quickMatches)
        .set({ status: 'cancelled', completedAt: now })
        .where(
          and(
            sql`${quickMatches.status} in ('waiting', 'active')`,
            sql`(${quickMatches.userAId} = ${userId} or ${quickMatches.userBId} = ${userId})`,
          ),
        );
      return tx.delete(userPhotos).where(eq(userPhotos.userId, userId)).returning();
    });
    await Promise.all(photos.map((p) => this.storage.remove(p.url)));
    if (user.firebaseUid) await this.firebase.deleteUser(user.firebaseUid);
  }
}