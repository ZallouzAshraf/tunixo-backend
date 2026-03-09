import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OrderStatus, AccountStatus } from '@prisma/client';

export interface DashboardStats {
  totalUsers: number;
  totalOrders: number;
  totalRevenue: number;
  stockLevels: { serviceId: string; serviceName: string; count: number }[];
}

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  async getDashboardStats(): Promise<DashboardStats> {
    const [totalUsers, totalOrders, ordersForRevenue, accountsByService] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.order.count(),
        this.prisma.order.findMany({
          where: { status: OrderStatus.ACTIVE },
          select: { amountPaid: true },
        }),
        this.prisma.account.groupBy({
          by: ['serviceId'],
          where: { status: AccountStatus.AVAILABLE },
          _count: { id: true },
        }),
      ]);
    const totalRevenue = ordersForRevenue.reduce((sum, o) => sum + o.amountPaid, 0);
    const serviceIds = accountsByService.map((a) => a.serviceId);
    const services = await this.prisma.service.findMany({
      where: { id: { in: serviceIds } },
      select: { id: true, name: true },
    });
    const serviceMap = new Map(services.map((s) => [s.id, s.name]));
    const stockLevels = accountsByService.map((a) => ({
      serviceId: a.serviceId,
      serviceName: serviceMap.get(a.serviceId) ?? 'Unknown',
      count: a._count.id,
    }));
    return {
      totalUsers,
      totalOrders,
      totalRevenue,
      stockLevels,
    };
  }

  async getAllOrders(filters: {
    page?: number;
    limit?: number;
    status?: OrderStatus;
  }) {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
    const skip = (page - 1) * limit;
    const where = filters.status ? { status: filters.status } : {};
    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: { user: { select: { id: true, email: true, fullName: true } }, service: { select: { id: true, name: true, slug: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);
    return { data: orders, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getAllUsers(filters: { page?: number; limit?: number }) {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        select: { id: true, email: true, fullName: true, phone: true, role: true, walletBalance: true, isVerified: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count(),
    ]);
    return { data: users, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async fulfillOrder(
    orderId: string,
    credentials: Record<string, unknown>,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { service: true, user: true },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (order.status !== OrderStatus.PENDING) {
      throw new Error('Order is not pending fulfillment');
    }
    const account = await this.prisma.account.create({
      data: {
        serviceId: order.serviceId,
        credentials: credentials as object,
        status: AccountStatus.USED,
      },
    });
    await this.prisma.order.update({
      where: { id: orderId },
      data: { accountId: account.id, status: OrderStatus.ACTIVE },
    });
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await this.notificationsService
      .sendOrderDelivered({
        email: order.user.email,
        fullName: order.user.fullName ?? '',
        orderId: order.id,
        serviceName: order.service.name,
        credentials: credentials as Record<string, any>,
        expiresAt,
      })
      .catch(() => {});
    return this.prisma.order.findUnique({
      where: { id: orderId },
      include: { service: true, account: true },
    });
  }
}
