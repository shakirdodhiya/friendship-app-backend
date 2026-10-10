import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/types/auth-user';
import { ChatsService } from './chats.service';
import {
  ChatDto,
  ChatListDto,
  GiftResultDto,
  MessageDto,
  MessagePageDto,
  MessagesQueryDto,
  SendGiftDto,
  SendMessageDto,
  StartChatDto,
} from './dto/chat.dto';

@ApiTags('Chats')
@ApiBearerAuth()
@Controller('chats')
export class ChatsController {
  constructor(private readonly chats: ChatsService) {}

  @Get()
  @ApiOperation({ summary: 'My open chats, most recent first, with unread counts and the free-chat meter' })
  list(@CurrentUser() user: AuthUser): Promise<ChatListDto> {
    return this.chats.list(user.id);
  }

  @Post()
  @ApiOperation({
    summary: 'Open a chat with someone ("Say hi")',
    description:
      'Returns the existing open chat if there is one. Free users are limited to FREE_CHAT_CAPACITY open chats (403 CHAT_CAPACITY_REACHED).',
  })
  start(@CurrentUser() user: AuthUser, @Body() dto: StartChatDto): Promise<ChatDto> {
    return this.chats.openWith(user.id, dto.userId);
  }

  @Get(':chatId')
  @ApiOperation({ summary: 'One chat' })
  get(@CurrentUser() user: AuthUser, @Param('chatId', ParseUUIDPipe) chatId: string): Promise<ChatDto> {
    return this.chats.get(user.id, chatId);
  }

  @Get(':chatId/messages')
  @ApiOperation({ summary: 'Message history, paged backwards with `before`' })
  messages(
    @CurrentUser() user: AuthUser,
    @Param('chatId', ParseUUIDPipe) chatId: string,
    @Query() query: MessagesQueryDto,
  ): Promise<MessagePageDto> {
    return this.chats.messages(user.id, chatId, query);
  }

  @Post(':chatId/messages')
  @ApiOperation({ summary: 'Send a text message' })
  send(
    @CurrentUser() user: AuthUser,
    @Param('chatId', ParseUUIDPipe) chatId: string,
    @Body() dto: SendMessageDto,
  ): Promise<MessageDto> {
    return this.chats.sendText(user.id, chatId, dto.text);
  }

  @Post(':chatId/gifts')
  @ApiOperation({ summary: 'Gift coins to the other person', description: '402 INSUFFICIENT_COINS when the balance is too low.' })
  gift(
    @CurrentUser() user: AuthUser,
    @Param('chatId', ParseUUIDPipe) chatId: string,
    @Body() dto: SendGiftDto,
  ): Promise<GiftResultDto> {
    return this.chats.sendGift(user.id, chatId, dto.coins);
  }

  @Post(':chatId/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark the chat as read (sends a read receipt)' })
  read(@CurrentUser() user: AuthUser, @Param('chatId', ParseUUIDPipe) chatId: string): Promise<void> {
    return this.chats.markRead(user.id, chatId);
  }

  @Delete(':chatId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Leave / close the chat for both people' })
  leave(@CurrentUser() user: AuthUser, @Param('chatId', ParseUUIDPipe) chatId: string): Promise<void> {
    return this.chats.leave(user.id, chatId);
  }
}
