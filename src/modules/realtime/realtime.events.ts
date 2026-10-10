import type { MessageDto } from '../chats/dto/chat.dto';
import type { QuickMatchDto } from '../quick-match/dto/quick-match.dto';

/**
 * Events the server pushes on the `/realtime` Socket.IO namespace.
 * Each user is in a private room, so every event reaches all of that user's devices.
 */
export interface ServerToClientEvents {
  /** A message in one of my chats — mine (from another device) or theirs. */
  'message.new': (payload: MessageDto) => void;
  /** The other person read the chat up to `readAt`; my messages before then are now "read". */
  'chat.read': (payload: { chatId: string; userId: string; readAt: string }) => void;
  /** The chat was closed (someone left it or a quick chat ended without both keeping it). */
  'chat.closed': (payload: { chatId: string }) => void;
  'chat.typing': (payload: { chatId: string; userId: string }) => void;
  'wallet.updated': (payload: { coins: number }) => void;
  /** My quick match found a partner, or a decision / result changed. */
  'quickMatch.updated': (payload: QuickMatchDto) => void;
}

export interface ClientToServerEvents {
  /** Tell the other participant I am typing. */
  typing: (payload: { chatId: string }) => void;
}

export const userRoom = (userId: string) => `user:${userId}`;
