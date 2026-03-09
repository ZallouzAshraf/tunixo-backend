import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiExcludeEndpoint,
} from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('topup')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Initiate wallet top-up via Konnect' })
  @ApiResponse({
    status: 201,
    description: 'Payment initiated — returns payUrl',
  })
  async topup(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: InitiatePaymentDto,
  ) {
    return this.paymentsService.initiateWalletTopup(user.userId, dto);
  }

  @Post('webhook')
  @ApiExcludeEndpoint()
  @ApiOperation({ summary: 'Konnect webhook — do not call manually' })
  async webhook(@Body() payload: Record<string, unknown>) {
    try {
      await this.paymentsService.handleWebhook(payload);
    } catch {
      // Always return 200 so Konnect does not retry
    }
    return { received: true };
  }

  @Get(':ref/verify')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Verify payment status' })
  @ApiResponse({ status: 200, description: 'Payment status' })
  async verify(
    @CurrentUser() user: CurrentUserPayload,
    @Param('ref') ref: string,
  ) {
    return this.paymentsService.verifyPayment(ref, user.userId);
  }
}
