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
import { FulfillOrderDto } from './dto/create-order.dto';
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
    const buyerCommission = Number(
      this.configService.get<string>('BUYER_COMMISSION', '0.10'),
    );
    const result = await this.prisma.$transaction(async (tx) => {
      const service = await tx.service.findUnique({
        where: { id: dto.serviceId },
      });
      if (!service || !service.isActive) {
        throw new NotFoundException('Service not found or inactive');
      }

      const buyer = await tx.user.findUnique({
        where: { id: userId },
        select: { walletBalance: true },
      });
      if (!buyer) {
        throw new NotFoundException('User not found');
      }
      if (buyer.walletBalance < service.priceTnd) {
        throw new BadRequestException('Insufficient wallet balance');
      }

      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { walletBalance: { decrement: service.priceTnd } },
      });

      await tx.transaction.create({
        data: {
          userId,
          amount: -service.priceTnd,
          type: TransactionType.DEBIT,
          description: `Order: ${service.name}`,
          reference: `order-${Date.now()}`,
          balanceAfter: updatedUser.walletBalance,
        },
      });

      const deposit = await tx.sellerDeposit.findFirst({
        where: {
          status: DepositStatus.CONFIRMED,
          amountUsd: { gte: service.priceUsd },
        },
        orderBy: { confirmedAt: 'asc' },
      });
      if (!deposit) {
        // PlatformReserve could be used here later
      }

      const platformFee = service.priceTnd * buyerCommission;

      const order = await tx.order.create({
        data: {
          userId,
          serviceId: dto.serviceId,
          amountPaid: service.priceTnd,
          platformFee,
          depositId: deposit?.id ?? null,
          status: OrderStatus.PENDING,
        },
      });

      const account = await tx.account.findFirst({
        where: {
          serviceId: dto.serviceId,
          status: 'AVAILABLE',
        },
      });

      if (account) {
        await tx.account.update({
          where: { id: account.id },
          data: { status: 'USED' },
        });
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        const activeOrder = await tx.order.update({
          where: { id: order.id },
          data: {
            accountId: account.id,
            status: OrderStatus.ACTIVE,
            expiresAt,
          },
          include: {
            service: true,
            account: true,
            user: { select: { email: true, fullName: true } },
          },
        });
        return { order: activeOrder, autoDelivered: true };
      }

      const pendingOrder = await tx.order.findUnique({
        where: { id: order.id },
        include: {
          service: true,
          user: { select: { email: true, fullName: true } },
        },
      });
      return { order: pendingOrder!, autoDelivered: false };
    });

    const orderWithAccount = result.order as typeof result.order & { account?: { credentials: unknown }; expiresAt?: Date };
    if (result.autoDelivered && orderWithAccount.account) {
      await this.notificationsService
        .sendOrderDelivered({
          email: orderWithAccount.user.email,
          fullName: orderWithAccount.user.fullName ?? '',
          orderId: result.order.id,
          serviceName: result.order.service.name,
          credentials: orderWithAccount.account.credentials as Record<string, any>,
          expiresAt: orderWithAccount.expiresAt ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        })
        .catch(() => {});
    } else {
      const u = result.order.user as { email: string; fullName?: string | null };
      if (u) {
        await this.notificationsService
          .sendOrderPending({
            email: u.email,
            fullName: u.fullName ?? '',
            orderId: result.order.id,
            serviceName: result.order.service.name,
            amountPaid: result.order.amountPaid,
          })
          .catch(() => {});
        await this.notificationsService
          .notifyAdminPendingOrder({
            buyerEmail: u.email,
            serviceName: result.order.service.name,
            orderId: result.order.id,
            amountPaid: result.order.amountPaid,
          })
          .catch(() => {});
      }
    }

    const { user, ...orderRest } = result.order;
    return {
      order: {
        ...orderRest,
        credentials: result.autoDelivered ? (orderWithAccount.account?.credentials ?? undefined) : undefined,
      },
      autoDelivered: result.autoDelivered,
    };
  }

  async findMyOrders(userId: string) {
    const orders = await this.prisma.order.findMany({
      where: { userId },
      include: { service: true, account: true },
      orderBy: { createdAt: 'desc' },
    });
    return orders.map((o) => {
      const { account, ...rest } = o;
      const credentials =
        o.status === OrderStatus.ACTIVE && account
          ? (account.credentials as Record<string, unknown>)
          : undefined;
      return { ...rest, account: account ? { id: account.id, status: account.status } : null, credentials };
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
    const isOwner = order.userId === userId;
    if (!isOwner) {
      throw new ForbiddenException('Not your order');
    }
    const credentials =
      order.status === OrderStatus.ACTIVE && order.account
        ? (order.account.credentials as Record<string, unknown>)
        : undefined;
    const { account, ...rest } = order;
    return { ...rest, credentials };
  }

  async fulfillOrder(orderId: string, _adminId: string, dto: FulfillOrderDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { service: true, user: true },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('Order is not pending fulfillment');
    }
    const expiresAt = dto.expiresAt
      ? new Date(dto.expiresAt)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const account = await this.prisma.account.create({
      data: {
        serviceId: order.serviceId,
        credentials: dto.credentials as object,
        status: 'USED',
        expiresAt,
      },
    });

    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        accountId: account.id,
        status: OrderStatus.ACTIVE,
        expiresAt,
      },
    });

    await this.notificationsService
      .sendOrderDelivered({
        email: order.user.email,
        fullName: order.user.fullName ?? '',
        orderId: order.id,
        serviceName: order.service.name,
        credentials: dto.credentials as Record<string, any>,
        expiresAt,
      })
      .catch(() => {});

    return this.prisma.order.findUnique({
      where: { id: orderId },
      include: { service: true, account: true },
    });
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
          service: { select: { id: true, name: true, slug: true } },
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
