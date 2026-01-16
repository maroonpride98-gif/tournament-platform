import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class ChatService {
  constructor(
    private prisma: PrismaService,
    private eventsGateway: EventsGateway,
  ) {}

  async getOrCreateTournamentChatRoom(tournamentId: string) {
    let chatRoom = await this.prisma.chatRoom.findFirst({
      where: { tournamentId },
    });

    if (!chatRoom) {
      chatRoom = await this.prisma.chatRoom.create({
        data: {
          name: 'Tournament Chat',
          tournamentId,
        },
      });
    }

    return chatRoom;
  }

  async getMessages(chatRoomId: string, options?: { limit?: number; before?: string }) {
    const { limit = 50, before } = options || {};

    const where: any = { chatRoomId };
    if (before) {
      where.createdAt = { lt: new Date(before) };
    }

    const messages = await this.prisma.message.findMany({
      where,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    return messages.reverse();
  }

  async sendMessage(chatRoomId: string, userId: string, content: string) {
    const chatRoom = await this.prisma.chatRoom.findUnique({
      where: { id: chatRoomId },
    });

    if (!chatRoom) {
      throw new NotFoundException('Chat room not found');
    }

    const message = await this.prisma.message.create({
      data: {
        content,
        chatRoomId,
        userId,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    // Emit via socket
    this.eventsGateway.emitChatMessage(chatRoomId, message);

    return message;
  }

  async getTeamChatRoom(teamId: string) {
    let chatRoom = await this.prisma.chatRoom.findFirst({
      where: { teamId },
    });

    if (!chatRoom) {
      chatRoom = await this.prisma.chatRoom.create({
        data: {
          name: 'Team Chat',
          teamId,
        },
      });
    }

    return chatRoom;
  }
}
