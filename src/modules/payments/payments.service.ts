import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WalletService } from '../wallet/wallet.service';
import { NotificationsService } from '../notifications/notifications.service';
import { KonnectProvider } from './providers/konnect.provider';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PaymentsService {
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
    const orderId = `topup_${userId}_${Date.now()}`;
    const backendUrl = (this.configService.get<string>('BACKEND_URL') ?? 'http://localhost:3001').replace(
      /\/$/,
      '',
    );
    const frontendUrl = (this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:3000').replace(
      /\/$/,
      '',
    );
    const webhookUrl = `${backendUrl}/payments/webhook`;
    const successUrl = `${frontendUrl}/wallet?status=success`;
    const failUrl = `${frontendUrl}/wallet?status=failed`;

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
      return { success: true };
    }
    const orderId =
      (payload['orderId'] as string) ?? (payload['order_id'] as string) ?? '';
    const match = orderId.match(/^topup_(.+)_(\d+)$/);
    const userId = match?.[1];
    if (!userId) {
      return { success: true };
    }
    const amountTnd = amount > 0 ? amount / 1000 : 0;
    if (amountTnd <= 0) {
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
        select: { email: true },
      });
      if (user) {
        await this.notificationsService
          .sendPaymentConfirmation(user.email, amountTnd)
          .catch(() => {});
      }
    } catch {
      // Log but do not rethrow — webhook must return 200
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
