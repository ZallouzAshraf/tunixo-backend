import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { PaymentsService } from '../payments/payments.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';

@Controller('wallet')
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(
    private readonly walletService: WalletService,
    private readonly paymentsService: PaymentsService,
  ) {}

  @Get('balance')
  async getBalance(@CurrentUser() user: CurrentUserPayload) {
    const balance = await this.walletService.getBalance(user.sub);
    return { balance };
  }

  @Get('transactions')
  getTransactions(@CurrentUser() user: CurrentUserPayload) {
    return this.walletService.getTransactions(user.sub);
  }

  @Post('topup')
  async topUp(@CurrentUser() user: CurrentUserPayload) {
    return this.paymentsService.initiatePayment(user.sub, 0);
  }
}
