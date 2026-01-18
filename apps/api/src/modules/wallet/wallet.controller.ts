import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WalletService } from './wallet.service';

@Controller('wallet')
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private walletService: WalletService) {}

  @Get('balance')
  async getBalance(@Request() req) {
    const balance = await this.walletService.getBalance(req.user.id);
    return { balance };
  }

  @Get('transactions')
  async getTransactions(
    @Request() req,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.walletService.getTransactions(
      req.user.id,
      page ? parseInt(page) : 1,
      pageSize ? parseInt(pageSize) : 20,
    );
  }

  @Post('admin/add-credits')
  async adminAddCredits(
    @Request() req,
    @Body() body: { userId: string; amount: number; reason?: string },
  ) {
    return this.walletService.adminAddCredits(
      req.user.id,
      body.userId,
      body.amount,
      body.reason,
    );
  }
}
