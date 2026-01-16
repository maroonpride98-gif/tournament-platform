import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('tournament/:tournamentId')
  async getTournamentChatRoom(@Param('tournamentId') tournamentId: string) {
    return this.chatService.getOrCreateTournamentChatRoom(tournamentId);
  }

  @Get('my-rooms')
  async getUserChatRooms(@Request() req: any) {
    return this.chatService.getUserChatRooms(req.user.id);
  }

  @Get(':chatRoomId/messages')
  async getMessages(
    @Param('chatRoomId') chatRoomId: string,
    @Query('limit') limit?: number,
    @Query('before') before?: string,
  ) {
    return this.chatService.getMessages(chatRoomId, { limit, before });
  }

  @Post(':chatRoomId/messages')
  async sendMessage(
    @Param('chatRoomId') chatRoomId: string,
    @Body('content') content: string,
    @Request() req: any,
  ) {
    return this.chatService.sendMessage(chatRoomId, req.user.id, content);
  }
}
