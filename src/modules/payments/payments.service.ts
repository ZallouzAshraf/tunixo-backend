import { BadRequestException, Injectable, Inject, forwardRef, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WalletService } from '../wallet/wallet.service';
import { NotificationsService } from '../notifications/notifications.service';
import { KonnectProvider } from './providers/konnect.provider';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private configService: ConfigService,
    @Inject(forwardRef(() => WalletService))
    private walletService: WalletService,
    private notificationsService: NotificationsService,
    private konnectProvider: KonnectProvider,
    private prisma: PrismaService,
  ) {}

  async initiatePayment(userId: string, amount?: number): Promise<{ paymentRef: string; payUrl: string; amount: number }> {
    return this.initiateWalletTopup(userId, {
      amount: amount && amount > 0 ? amount : 50,
      description: 'Wallet top-up',
    });
  }

  async initiateWalletTopup(
    userId: string,
    dto: InitiatePaymentDto,
  ): Promise<{ paymentRef: string; payUrl: string; amount: number }> {
    if (dto.amount < 5) {
      throw new BadRequestException('Minimum amount is 5 TND');
    }
    const orderId = `topup_${userId}_${Date.now()}`;
    const webhookUrl =
      this.configService.get<string>('konnect.webhookUrl') ??
      `${(this.configService.get<string>('BACKEND_URL') ?? 'http://localhost:3001').replace(/\/$/, '')}/payments/webhook`;
    const successUrl =
      this.configService.get<string>('konnect.successUrl') ??
      `${(this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:3000').replace(/\/$/, '')}/wallet?status=success`;
    const failUrl =
      this.configService.get<string>('konnect.failUrl') ??
      `${(this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:3000').replace(/\/$/, '')}/wallet?status=failed`;

    const result = await this.konnectProvider.initPayment({
      amount: dto.amount,
      description: dto.description ?? 'Wallet top-up',
      orderId,
      webhookUrl,
      successUrl,
      failUrl,
    });

    return {
      paymentRef: result.paymentRef,
      payUrl: result.payUrl,
      amount: dto.amount,
    };
  }

  async handleWebhook(payload: Record<string, unknown>): Promise<{ success: boolean }> {
    this.logger.log('Konnect webhook received: ' + JSON.stringify(payload));

    if (!this.konnectProvider.verifyWebhookSignature(payload)) {
      return { success: true };
    }
    const paymentRef =
      (payload['payment_ref'] as string) ??
      (payload['paymentRef'] as string) ??
      '';
    if (!paymentRef) {
      return { success: true };
    }
    let status: string;
    let amount: number;
    try {
      const payment = await this.konnectProvider.getPayment(paymentRef);
      status = payment.status;
      amount = payment.amount;
    } catch {
      return { success: true };
    }
    if (status !== 'completed' && status !== 'paid') {
      this.logger.warn(`Payment not completed: ${status}`);
      return { success: true };
    }
    const orderId =
      (payload['orderId'] as string) ?? (payload['order_id'] as string) ?? '';
    const match = orderId.match(/^topup_(.+)_(\d+)$/);
    const userId = match?.[1];
    if (!userId) {
      this.logger.warn(`Unknown order format: ${orderId}`);
      return { success: true };
    }
    const amountTnd = amount > 0 ? amount / 1000 : 0;
    if (amountTnd <= 0) {
      return { success: true };
    }

    // Idempotency: do not credit twice for the same payment
    const existing = await this.prisma.transaction.findFirst({
      where: { reference: paymentRef },
    });
    if (existing) {
      this.logger.warn(`Payment already processed: ${paymentRef}`);
      return { success: true };
    }

    try {
      await this.walletService.credit(
        userId,
        amountTnd,
        paymentRef,
        'Wallet top-up via Konnect',
      );
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, fullName: true },
      });
      if (user) {
        const newBalance = await this.walletService.getBalance(userId);
        await this.notificationsService
          .sendWalletCredited({
            email: user.email,
            fullName: user.fullName ?? '',
            amount: amountTnd,
            newBalance,
            reference: paymentRef,
          })
          .catch(() => {});
      }
      this.logger.log(`Wallet credited: ${amountTnd} TND for user ${userId}`);
    } catch (err) {
      this.logger.error('Webhook processing error', err);
      // Never throw — webhook must return 200
    }
    return { success: true };
  }

  async verifyPayment(
    paymentRef: string,
    _userId: string,
  ): Promise<{ status: string; amount: number }> {
    const payment = await this.konnectProvider.getPayment(paymentRef);
    const amountTnd = payment.amount > 0 ? payment.amount / 1000 : 0;
    return {
      status: payment.status,
      amount: amountTnd,
    };
  }
}
