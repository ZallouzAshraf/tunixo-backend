import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderStatus } from '@prisma/client';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private walletService: WalletService,
    private notificationsService: NotificationsService,
  ) {}

  async create(userId: string, dto: CreateOrderDto) {
    const service = await this.prisma.service.findUnique({
      where: { id: dto.serviceId, isActive: true },
    });
    if (!service) {
      throw new NotFoundException('Service not found');
    }
    const balance = await this.walletService.getBalance(userId);
    if (balance < service.priceTnd) {
      throw new BadRequestException(
        `Insufficient wallet balance. Required: ${service.priceTnd} TND`,
      );
    }
    await this.walletService.debit(
      userId,
      service.priceTnd,
      `order-${Date.now()}`,
      `Order for ${service.name}`,
    );
    const availableAccount = await this.prisma.account.findFirst({
      where: { serviceId: dto.serviceId, status: 'AVAILABLE' },
    });
    let orderStatus: OrderStatus = OrderStatus.PENDING;
    let accountId: string | null = null;
    let credentials: Record<string, unknown> | null = null;
    if (availableAccount) {
      orderStatus = OrderStatus.ACTIVE;
      accountId = availableAccount.id;
      credentials = availableAccount.credentials as Record<string, unknown>;
      await this.prisma.account.update({
        where: { id: availableAccount.id },
        data: { status: 'USED' },
      });
    }
    const order = await this.prisma.order.create({
      data: {
        userId,
        serviceId: dto.serviceId,
        accountId,
        amountPaid: service.priceTnd,
        status: orderStatus,
        paymentReference: `order-${Date.now()}`,
      },
      include: {
        service: true,
        account: true,
      },
    });
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (orderStatus === OrderStatus.ACTIVE && user && credentials) {
      await this.notificationsService.sendOrderConfirmation(
        user.email,
        order,
        credentials,
      );
    } else if (orderStatus === OrderStatus.PENDING && user) {
      await this.notificationsService.sendOrderPending(
        user.email,
        service.name,
      );
    }
    const result = { ...order, credentials: orderStatus === OrderStatus.ACTIVE ? credentials : undefined };
    return result;
  }

  async findUserOrders(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      include: { service: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string, userId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, userId },
      include: { service: true, account: true },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    const credentials =
      order.account && order.status === OrderStatus.ACTIVE
        ? (order.account.credentials as Record<string, unknown>)
        : undefined;
    const { account, ...rest } = order;
    return { ...rest, credentials };
  }
}
