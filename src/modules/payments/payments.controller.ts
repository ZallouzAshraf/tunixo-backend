import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('initiate')
  @UseGuards(JwtAuthGuard)
  async initiate(
    @CurrentUser() user: CurrentUserPayload,
    @Body('amount') amount: number,
  ) {
    return this.paymentsService.initiatePayment(user.sub, amount ?? 0);
  }

  @Post('webhook')
  async webhook(@Body() payload: Record<string, unknown>) {
    await this.paymentsService.handleWebhook(payload as any);
    return { received: true };
  }

  @Get(':id/verify')
  @UseGuards(JwtAuthGuard)
  async verify(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.paymentsService.verifyPayment(id, user.sub);
  }
}
