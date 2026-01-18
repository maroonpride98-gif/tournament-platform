import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { Notification, NotificationType } from 'database';

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private eventsGateway: EventsGateway,
  ) {}

  async getNotifications(userId: string, options?: { limit?: number }): Promise<Notification[]> {
    const { limit = 20 } = options || {};

    return this.prisma.notification.findMany({
      where: { userId },
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
  }

  async createNotification(data: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    link?: string;
  }): Promise<Notification> {
    const notification = await this.prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        data: data.link ? { link: data.link } : undefined,
        read: false,
      },
    });

    // Emit via socket
    this.eventsGateway.emitNotification(data.userId, notification);

    return notification;
  }

  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { read: true },
    });
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  }

  async deleteNotification(notificationId: string, userId: string): Promise<void> {
    await this.prisma.notification.deleteMany({
      where: { id: notificationId, userId },
    });
  }

  // Helper methods for common notifications
  async notifyTournamentRegistration(userId: string, tournamentName: string, tournamentSlug: string): Promise<Notification> {
    return this.createNotification({
      userId,
      type: NotificationType.TOURNAMENT_REMINDER,
      title: 'Registration Confirmed',
      message: `You have successfully registered for ${tournamentName}`,
      link: `/tournaments/${tournamentSlug}`,
    });
  }

  async notifyTournamentStart(userId: string, tournamentName: string, tournamentSlug: string): Promise<Notification> {
    return this.createNotification({
      userId,
      type: NotificationType.TOURNAMENT_REMINDER,
      title: 'Tournament Starting',
      message: `${tournamentName} is starting now!`,
      link: `/tournaments/${tournamentSlug}`,
    });
  }

  async notifyMatchReady(userId: string, tournamentName: string, tournamentSlug: string): Promise<Notification> {
    return this.createNotification({
      userId,
      type: NotificationType.MATCH_READY,
      title: 'Match Ready',
      message: `Your match in ${tournamentName} is ready to start`,
      link: `/tournaments/${tournamentSlug}`,
    });
  }

  async notifyPrizeWon(
    userId: string,
    amount: number,
    tournamentName: string,
    placement?: number,
    tournamentSlug?: string,
  ): Promise<Notification> {
    const placementText = placement ? this.getPlacementLabel(placement) : '';
    const title = placement === 1 ? '🏆 Tournament Winner!' : '🎉 Prize Won!';

    return this.createNotification({
      userId,
      type: NotificationType.PRIZE_PAYOUT,
      title,
      message: `Congratulations! You placed ${placementText} and won $${amount.toFixed(2)} in ${tournamentName}`,
      link: tournamentSlug ? `/tournaments/${tournamentSlug}` : '/wallet',
    });
  }

  private getPlacementLabel(placement: number): string {
    switch (placement) {
      case 1:
        return '1st';
      case 2:
        return '2nd';
      case 3:
        return '3rd';
      default:
        return `${placement}th`;
    }
  }

  async notifyTeamInvite(userId: string, teamName: string, teamTag: string): Promise<Notification> {
    return this.createNotification({
      userId,
      type: NotificationType.TEAM_INVITE,
      title: 'Team Invitation',
      message: `You have been invited to join ${teamName}`,
      link: `/teams/${teamTag}`,
    });
  }
}
