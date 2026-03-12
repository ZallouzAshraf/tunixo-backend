import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';
import { SmileOneService } from '../topup/smile-one.service';
import { WalletService } from '../wallet/wallet.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OrderStatus } from '@prisma/client';

export const TOPUP_QUEUE = 'topup';

@Processor(TOPUP_QUEUE)
export class TopupProcessor {
  constructor(
    private prisma: PrismaService,
    private smileOneService: SmileOneService,
    private walletService: WalletService,
    private notificationsService: NotificationsService,
  ) {}

  @Process('check-status')
  async handleCheckStatus(job: Job<{ orderId: string }>) {
    const { orderId } = job.data;
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { product: true, user: true },
    });
    if (!order || order.status !== OrderStatus.PROCESSING || !order.apiReference) {
      return;
    }
    const result = await this.smileOneService.checkOrder(order.apiReference);
    const status = (result.status || '').toUpperCase();
    if (status === 'COMPLETED' || status === 'SUCCESS' || status === 'DELIVERED') {
      await this.prisma.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.COMPLETED },
      });
      this.notificationsService
        .sendTopupCompleted(order.user, order, order.product)
        .catch(() => {});
      return;
    }
    if (status === 'FAILED' || status === 'REFUNDED' || status === 'CANCELLED') {
      await this.prisma.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.FAILED, failureReason: result.status },
      });
      await this.walletService.credit(
        order.userId,
        order.amountPaid,
        orderId,
        `Refund: Top-up failed - ${result.status}`,
      );
      this.notificationsService
        .sendTopupFailed(order.user, { failureReason: result.status, amountPaid: order.amountPaid }, order.product)
        .catch(() => {});
    }
    // else still processing - job will retry
  }
}
