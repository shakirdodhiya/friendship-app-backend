import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';

import { DB, type Database } from '../../database/database.module';
import { devices, users } from '../../database/schema';
import { PresenceService } from '../realtime/presence.service';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export interface PushMessage {
  title: string;
  body: string;
  /** Delivered to the app with the notification, e.g. `{ type: 'message', chatId }` for deep-linking. */
  data?: Record<string, unknown>;
}

/**
 * Sends push notifications through the Expo push service (the mobile app is an Expo app).
 * Skipped for users who are connected over the socket — they already get the realtime event —
 * and for users who turned notifications off.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly presence: PresenceService,
  ) {}

  /** Fire-and-forget: never throws, never blocks the caller. */
  notify(userId: string, message: PushMessage): void {
    if (this.presence.hasSocket(userId)) return;
    this.send(userId, message).catch((error) => this.logger.warn(`Push to ${userId} failed: ${error}`));
  }

  private async send(userId: string, message: PushMessage) {
    const tokens = await this.db
      .select({ token: devices.pushToken })
      .from(devices)
      .innerJoin(users, eq(users.id, devices.userId))
      .where(and(eq(devices.userId, userId), eq(users.notificationsEnabled, true)));
    const expoTokens = tokens.map((t) => t.token).filter((t) => t.startsWith('ExponentPushToken['));
    if (expoTokens.length === 0) return;

    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(expoTokens.map((to) => ({ to, sound: 'default', ...message }))),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`Expo push responded ${response.status}`);

    // Tokens of uninstalled apps come back as DeviceNotRegistered; forget them.
    const result = (await response.json()) as { data?: { status: string; details?: { error?: string } }[] };
    const dead = (result.data ?? [])
      .map((ticket, i) => (ticket.details?.error === 'DeviceNotRegistered' ? expoTokens[i] : null))
      .filter((t): t is string => t !== null);
    if (dead.length > 0) await this.db.delete(devices).where(inArray(devices.pushToken, dead));
  }
}
