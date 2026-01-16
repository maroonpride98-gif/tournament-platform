import { Injectable, NotFoundException } from '@nestjs/common';
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
          type: 'TOURNAMENT',
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
        sender: {
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
        senderId: userId,
      },
      include: {
        sender: {
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

  async createGroupChatRoom(name: string, memberIds: string[]) {
    const chatRoom = await this.prisma.chatRoom.create({
      data: {
        name,
        type: 'GROUP',
        members: {
          create: memberIds.map((userId) => ({ userId })),
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatar: true,
              },
            },
          },
        },
      },
    });

    return chatRoom;
  }

  async getUserChatRooms(userId: string) {
    const memberships = await this.prisma.chatRoomMember.findMany({
      where: { userId },
      include: {
        chatRoom: {
          include: {
            messages: {
              take: 1,
              orderBy: { createdAt: 'desc' },
            },
          },
        },
      },
    });

    return memberships.map((m) => m.chatRoom);
  }
}
