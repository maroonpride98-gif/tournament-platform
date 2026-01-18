import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('admin')
@UseGuards(JwtAuthGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  private checkAdmin(req: any) {
    if (req.user.role !== 'ADMIN') {
      throw new ForbiddenException('Admin access required');
    }
  }

  @Get('stats')
  async getStats(@Request() req: any) {
    this.checkAdmin(req);
    return this.adminService.getStats();
  }

  @Get('tournaments/recent')
  async getRecentTournaments(@Request() req: any) {
    this.checkAdmin(req);
    return this.adminService.getRecentTournaments();
  }

  @Get('tournaments')
  async getTournaments(
    @Request() req: any,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    this.checkAdmin(req);
    return this.adminService.getTournaments({ page, pageSize, status, search });
  }

  @Post('tournaments/:id/cancel')
  async cancelTournament(@Request() req: any, @Param('id') id: string) {
    this.checkAdmin(req);
    return this.adminService.cancelTournament(id, req.user.id);
  }

  @Get('users')
  async getUsers(
    @Request() req: any,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('search') search?: string,
    @Query('role') role?: string,
  ) {
    this.checkAdmin(req);
    return this.adminService.getUsers({ page, pageSize, search, role });
  }

  @Patch('users/:id/role')
  async updateUserRole(
    @Request() req: any,
    @Param('id') id: string,
    @Body('role') role: 'USER' | 'ORGANIZER' | 'ADMIN',
  ) {
    this.checkAdmin(req);
    return this.adminService.updateUserRole(id, role);
  }

  @Get('games')
  async getGames(
    @Request() req: any,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    this.checkAdmin(req);
    return this.adminService.getGames({ page, pageSize });
  }

  @Get('transactions/stats')
  async getTransactionStats(@Request() req: any) {
    this.checkAdmin(req);
    return this.adminService.getTransactionStats();
  }

  @Get('transactions')
  async getTransactions(
    @Request() req: any,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('userId') userId?: string,
    @Query('tournamentId') tournamentId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    this.checkAdmin(req);
    return this.adminService.getTransactions({
      page,
      pageSize,
      type,
      status,
      userId,
      tournamentId,
      startDate,
      endDate,
    });
  }

  @Get('payments/report')
  async getPaymentReport(
    @Request() req: any,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    this.checkAdmin(req);
    return this.adminService.getPaymentReport(startDate, endDate);
  }
}
