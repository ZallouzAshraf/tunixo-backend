import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { NotificationsService } from '../notifications/notifications.service';
import { KonnectProvider } from './providers/konnect.provider';

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    @Inject(forwardRef(() => WalletService))
    private walletService: WalletService,
    private notificationsService: NotificationsService,
    private konnectProvider: KonnectProvider,
  ) {}

  async initiatePayment(userId: string, amount: number) {
    const apiBase = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000').replace(/\/$/, '');
    const webhookUrl = `${apiBase}/api/payments/webhook`;
    const reference = `topup-${userId}-${Date.now()}`;
    const result = await this.konnectProvider.initPayment(
      amount > 0 ? amount : 50,
      webhookUrl,
      reference,
    );
    return {
      payUrl: result.payUrl,
      paymentId: result.paymentId,
      reference,
    };
  }

  async handleWebhook(payload: {
    paymentId?: string;
    status?: string;
    amount?: number;
    reference?: string;
    [key: string]: unknown;
  }): Promise<void> {
    if (payload.status !== 'completed' && payload.status !== 'success') {
      return;
    }
    const reference = String(payload.reference ?? '');
    const match = reference.match(/^topup-(.+)-(\d+)$/);
    const userId = match?.[1];
    if (!userId) return;
    const amount = Number(payload.amount ?? 0);
    if (amount <= 0) return;
    await this.walletService.credit(
      userId,
      amount,
      payload.paymentId as string,
      'Wallet top-up via Konnect',
    );
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (user) {
      await this.notificationsService.sendPaymentConfirmation(user.email, amount);
    }
  }

  async verifyPayment(paymentId: string, userId: string) {
    const payment = await this.konnectProvider.getPayment(paymentId);
    const status = payment.status;
    return {
      paymentId,
      status: status ?? 'unknown',
      amount: payment.amount,
    };
  }
}
