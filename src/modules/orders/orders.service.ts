import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderStatus, DepositStatus } from '@prisma/client';
import { TransactionType } from '@prisma/client';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private walletService: WalletService,
    private notificationsService: NotificationsService,
  ) {}

  async create(
    userId: string,
    dto: CreateOrderDto,
  ): Promise<{ order: any; autoDelivered: boolean }> {
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Get service
      const service = await tx.service.findUnique({
        where: { id: dto.serviceId },
      });
      if (!service || !service.isActive) {
        throw new NotFoundException('Service not found');
      }

      // 2. Get buyer
      const buyer = await tx.user.findUnique({
        where: { id: userId },
      });
      if (!buyer) {
        throw new NotFoundException('User not found');
      }
      if (buyer.walletBalance < service.priceTnd) {
        throw new BadRequestException('Insufficient wallet balance');
      }

      // 3. Debit buyer wallet
      await tx.user.update({
        where: { id: userId },
        data: { walletBalance: { decrement: service.priceTnd } },
      });

      // 4. Create DEBIT transaction
      const balanceAfter = buyer.walletBalance - service.priceTnd;
      await tx.transaction.create({
        data: {
          userId,
          amount: -service.priceTnd,
          type: TransactionType.DEBIT,
          description: `Order: ${service.name}`,
          balanceAfter,
        },
      });

      // 5. Find matching seller deposit
      const deposit = await tx.sellerDeposit.findFirst({
        where: {
          status: DepositStatus.CONFIRMED,
          amountUsd: { gte: service.priceUsd },
        },
        orderBy: { confirmedAt: 'asc' },
      });

      // 6. Calculate platform fee
      const platformFee =
        service.priceTnd * Number(process.env.BUYER_COMMISSION || 0.1);

      // 7. Create order with PENDING status — Admin will manually activate and mark as ACTIVE
      const order = await tx.order.create({
        data: {
          userId,
          serviceId: dto.serviceId,
          serviceEmail: dto.serviceEmail,
          amountPaid: service.priceTnd,
          platformFee,
          depositId: deposit?.id ?? null,
          status: OrderStatus.PENDING,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
        include: { service: true },
      });

      return { order, autoDelivered: false };
    });

    // Notify admin with serviceEmail
    const orderWithUser = await this.prisma.order.findUnique({
      where: { id: result.order.id },
      include: {
        service: true,
        user: { select: { email: true, fullName: true } },
      },
    });
    if (orderWithUser?.user) {
      await this.notificationsService
        .notifyAdminPendingOrder({
          buyerEmail: orderWithUser.user.email,
          buyerName: orderWithUser.user.fullName ?? orderWithUser.user.email,
          serviceName: orderWithUser.service.name,
          orderId: orderWithUser.id,
          amountPaid: orderWithUser.amountPaid,
          serviceEmail: orderWithUser.serviceEmail ?? '',
        })
        .catch(() => {});
      await this.notificationsService
        .sendOrderPending({
          email: orderWithUser.user.email,
          fullName: orderWithUser.user.fullName ?? '',
          orderId: orderWithUser.id,
          serviceName: orderWithUser.service.name,
          amountPaid: orderWithUser.amountPaid,
        })
        .catch(() => {});
    }

    return {
      order: result.order,
      autoDelivered: false,
    };
  }

  async markAsDelivered(orderId: string, adminId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { service: true, user: true },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('Order is not pending');
    }

    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.ACTIVE },
      include: { service: true, user: true },
    });

    const expiresAt = updatedOrder.expiresAt ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await this.notificationsService
      .sendOrderDelivered({
        email: updatedOrder.user.email,
        fullName: updatedOrder.user.fullName ?? '',
        serviceName: updatedOrder.service.name,
        serviceEmail: updatedOrder.serviceEmail ?? '',
        expiresAt,
      })
      .catch(() => {});

    return updatedOrder;
  }

  async findMyOrders(userId: string) {
    const orders = await this.prisma.order.findMany({
      where: { userId },
      include: { service: true },
      orderBy: { createdAt: 'desc' },
    });
    return orders;
  }

  async findById(id: string, userId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, userId },
      include: { service: true },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (order.userId !== userId) {
      throw new ForbiddenException('Not your order');
    }
    return order;
  }

  async cancelOrder(orderId: string, userId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { service: true },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (order.userId !== userId) {
      throw new ForbiddenException('Not your order');
    }
    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('Cannot cancel active order');
    }
    await this.walletService.credit(
      userId,
      order.amountPaid,
      orderId,
      `Refund: Order ${orderId} cancelled`,
    );
    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.REFUNDED },
      include: { service: true, user: { select: { email: true, fullName: true } } },
    });
    const newBalance = await this.walletService.getBalance(userId);
    await this.notificationsService
      .sendOrderRefunded({
        email: updatedOrder.user.email,
        fullName: updatedOrder.user.fullName ?? '',
        serviceName: updatedOrder.service.name,
        amountRefunded: order.amountPaid,
        newBalance,
      })
      .catch(() => {});
    return updatedOrder;
  }

  async findAllOrders(filters?: {
    status?: OrderStatus;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, filters?.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters?.limit ?? 20));
    const skip = (page - 1) * limit;
    const where = filters?.status ? { status: filters.status } : {};
    const [data, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          user: { select: { id: true, email: true, fullName: true } },
          service: { select: { id: true, name: true, slug: true, priceTnd: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);
    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getOrderStats() {
    const [
      totalOrders,
      activeOrders,
      pendingOrders,
      failedOrders,
      revenueResult,
      amountResult,
    ] = await Promise.all([
      this.prisma.order.count(),
      this.prisma.order.count({ where: { status: OrderStatus.ACTIVE } }),
      this.prisma.order.count({ where: { status: OrderStatus.PENDING } }),
      this.prisma.order.count({ where: { status: OrderStatus.FAILED } }),
      this.prisma.order.aggregate({
        _sum: { platformFee: true },
      }),
      this.prisma.order.aggregate({
        _sum: { amountPaid: true },
      }),
    ]);
    return {
      totalOrders,
      activeOrders,
      pendingOrders,
      failedOrders,
      totalRevenue: revenueResult._sum.platformFee ?? 0,
      totalAmountProcessed: amountResult._sum.amountPaid ?? 0,
    };
  }
}
