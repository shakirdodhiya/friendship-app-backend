import { Injectable } from '@nestjs/common';

import { PRESENCE } from '../../common/constants/catalog';

/**
 * Tracks which users have a socket open on this instance.
 * With more than one API instance, back this with Redis (and use the socket.io Redis adapter).
 */
@Injectable()
export class PresenceService {
  private readonly sockets = new Map<string, number>();

  connected(userId: string) {
    this.sockets.set(userId, (this.sockets.get(userId) ?? 0) + 1);
  }

  /** Returns true when that was the user's last socket. */
  disconnected(userId: string): boolean {
    const left = (this.sockets.get(userId) ?? 1) - 1;
    if (left <= 0) {
      this.sockets.delete(userId);
      return true;
    }
    this.sockets.set(userId, left);
    return false;
  }

  hasSocket(userId: string): boolean {
    return this.sockets.has(userId);
  }

  onlineUserIds(): string[] {
    return [...this.sockets.keys()];
  }

  isOnline(userId: string, lastActiveAt: Date, now = Date.now()): boolean {
    return this.hasSocket(userId) || now - lastActiveAt.getTime() < PRESENCE.onlineWindowSeconds * 1000;
  }
}
