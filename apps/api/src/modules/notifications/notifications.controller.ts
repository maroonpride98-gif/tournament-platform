import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Notification } from 'database';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async getNotifications(
    @Request() req: any,
    @Query('limit') limit?: number,
  ): Promise<Notification[]> {
    return this.notificationsService.getNotifications(req.user.id, { limit });
  }

  @Patch(':id/read')
  async markAsRead(@Param('id') id: string, @Request() req: any) {
    await this.notificationsService.markAsRead(id, req.user.id);
    return { success: true };
  }

  @Patch('read-all')
  async markAllAsRead(@Request() req: any) {
    await this.notificationsService.markAllAsRead(req.user.id);
    return { success: true };
  }

  @Delete(':id')
  async deleteNotification(@Param('id') id: string, @Request() req: any) {
    await this.notificationsService.deleteNotification(id, req.user.id);
    return { success: true };
  }
}
