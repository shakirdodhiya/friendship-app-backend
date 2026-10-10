import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import type { DecodedIdToken } from 'firebase-admin/auth';

import { AppConfig } from '../../config/app-config.service';
import { DB, type Database } from '../../database/database.module';
import { users } from '../../database/schema';
import { WalletLedgerService } from '../wallet/wallet-ledger.service';

export interface ResolvedUser {
  id: string;
  isNewUser: boolean;
}

/** Maps a verified Firebase identity onto our `users` row, creating it on first sign-in. */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly config: AppConfig,
    private readonly ledger: WalletLedgerService,
  ) {}

  /** Cheap lookup used on every request. */
  async findUser(firebaseUid: string): Promise<{ id: string; suspendedAt: Date | null } | undefined> {
    const [row] = await this.db
      .select({ id: users.id, suspendedAt: users.suspendedAt })
      .from(users)
      .where(and(eq(users.firebaseUid, firebaseUid), isNull(users.deletedAt)));
    return row;
  }

  /**
   * Finds or creates the user for this token and keeps phone / email / provider in sync with Firebase.
   * New users get the signup coin bonus. Safe to call concurrently for the same uid.
   */
  async resolve(token: DecodedIdToken): Promise<ResolvedUser> {
    const identity = {
      phone: token.phone_number ?? null,
      email: token.email ?? null,
      authProvider: token.firebase.sign_in_provider,
    };

    const existing = await this.db
      .select({ id: users.id, phone: users.phone, email: users.email, authProvider: users.authProvider })
      .from(users)
      .where(and(eq(users.firebaseUid, token.uid), isNull(users.deletedAt)));
    if (existing[0]) {
      const user = existing[0];
      const changed =
        user.phone !== identity.phone || user.email !== identity.email || user.authProvider !== identity.authProvider;
      if (changed) await this.db.update(users).set(identity).where(eq(users.id, user.id));
      return { id: user.id, isNewUser: false };
    }

    return this.db.transaction(async (tx) => {
      // The unique index on firebase_uid settles races between two first requests.
      const [created] = await tx
        .insert(users)
        .values({ firebaseUid: token.uid, ...identity })
        .onConflictDoNothing({ target: users.firebaseUid })
        .returning({ id: users.id });
      if (!created) {
        const [row] = await tx.select({ id: users.id }).from(users).where(eq(users.firebaseUid, token.uid));
        return { id: row.id, isNewUser: false };
      }

      const bonus = this.config.get('SIGNUP_BONUS_COINS');
      if (bonus > 0) {
        await this.ledger.apply(tx, { userId: created.id, amount: bonus, type: 'signup_bonus' });
      }
      this.logger.log(`New user ${created.id} via ${identity.authProvider}`);
      return { id: created.id, isNewUser: true };
    });
  }
}
