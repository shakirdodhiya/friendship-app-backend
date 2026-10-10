import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Length, Max, Min } from 'class-validator';

import { chatKindEnum, messageKindEnum } from '../../../database/schema';
import type { ChatKind, MessageKind } from '../../../database/schema';
import { PersonSummaryDto } from '../../people/dto/person.dto';

export const MESSAGE_STATUSES = ['sent', 'delivered', 'read'] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

export class MessageDto {
  id: string;
  chatId: string;
  /** Null for system messages. */
  senderId: string | null;
  /** True when the viewer sent it (the app's `author: 'me'`). */
  mine: boolean;
  @ApiProperty({ enum: messageKindEnum.enumValues })
  kind: MessageKind;
  text: string;
  /** Set on gift messages. */
  coins: number | null;
  imageUrl: string | null;
  /** Only for my own messages: how far the other person got. */
  @ApiProperty({ enum: MESSAGE_STATUSES, nullable: true })
  status: MessageStatus | null;
  createdAt: Date;
}

export class LastMessageDto {
  text: string;
  @ApiProperty({ enum: messageKindEnum.enumValues })
  kind: MessageKind;
  mine: boolean;
  createdAt: Date;
}

export class ChatDto {
  id: string;
  @ApiProperty({ enum: chatKindEnum.enumValues })
  kind: ChatKind;
  peer: PersonSummaryDto;
  lastMessage: LastMessageDto | null;
  unread: number;
  /** Quick chats only: when the chat stops accepting messages (the countdown pill). */
  expiresAt: Date | null;
  /** Set once someone left the chat; closed chats no longer accept messages. */
  closedAt: Date | null;
  createdAt: Date;
}

export class ChatCapacityDto {
  /** Open friend chats. */
  used: number;
  /** `null` means unlimited (Pro). */
  limit: number | null;
}

export class ChatListDto {
  capacity: ChatCapacityDto;
  items: ChatDto[];
}

export class MessagePageDto {
  /** Oldest first, ready to render. */
  items: MessageDto[];
  /** Pass as `before` to load older messages; null when there are none. */
  nextBefore: string | null;
}

export class StartChatDto {
  @IsUUID()
  userId: string;
}

export class MessagesQueryDto {
  /** A message id: return messages older than it. */
  @IsOptional()
  @IsUUID()
  before?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 30;
}

export class SendMessageDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 2000)
  text: string;
}

export class SendGiftDto {
  @IsInt()
  @Min(1)
  @Max(100000)
  coins: number;
}

export class GiftResultDto {
  message: MessageDto;
  /** My balance after the gift. */
  coins: number;
}
