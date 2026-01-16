import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private eventsGateway: EventsGateway,
  ) {}

  async getNotifications(userId: string, options?: { limit?: number }) {
    const { limit = 20 } = options || {};

    return this.prisma.notification.findMany({
      where: { userId },
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
  }

  async createNotification(data: {
    userId: string;
    type: string;
    title: string;
    message: string;
    link?: string;
  }) {
    const notification = await this.prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        link: data.link,
        read: false,
      },
    });

    // Emit via socket
    this.eventsGateway.emitNotification(data.userId, notification);

    return notification;
  }

  async markAsRead(notificationId: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { read: true },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  }

  async deleteNotification(notificationId: string, userId: string) {
    return this.prisma.notification.deleteMany({
      where: { id: notificationId, userId },
    });
  }

  // Helper methods for common notifications
  async notifyTournamentRegistration(userId: string, tournamentName: string, tournamentSlug: string) {
    return this.createNotification({
      userId,
      type: 'TOURNAMENT',
      title: 'Registration Confirmed',
      message: `You have successfully registered for ${tournamentName}`,
      link: `/tournaments/${tournamentSlug}`,
    });
  }

  async notifyTournamentStart(userId: string, tournamentName: string, tournamentSlug: string) {
    return this.createNotification({
      userId,
      type: 'TOURNAMENT',
      title: 'Tournament Starting',
      message: `${tournamentName} is starting now!`,
      link: `/tournaments/${tournamentSlug}`,
    });
  }

  async notifyMatchReady(userId: string, tournamentName: string, tournamentSlug: string) {
    return this.createNotification({
      userId,
      type: 'TOURNAMENT',
      title: 'Match Ready',
      message: `Your match in ${tournamentName} is ready to start`,
      link: `/tournaments/${tournamentSlug}`,
    });
  }

  async notifyPrizeWon(userId: string, amount: number, tournamentName: string) {
    return this.createNotification({
      userId,
      type: 'PAYMENT',
      title: 'Prize Won!',
      message: `Congratulations! You won $${amount.toFixed(2)} in ${tournamentName}`,
    });
  }

  async notifyTeamInvite(userId: string, teamName: string, teamTag: string) {
    return this.createNotification({
      userId,
      type: 'TEAM',
      title: 'Team Invitation',
      message: `You have been invited to join ${teamName}`,
      link: `/teams/${teamTag}`,
    });
  }
}
