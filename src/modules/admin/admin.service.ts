import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaginationDto, UpdateUserRoleDto } from './dto/admin.dto';
import { Role, OrderStatus, CodeStatus } from '@prisma/client';

@Injectable()
export class AdminService {
  private exchangeRates = {
    officialRate: 3.15,
    platformRate: 3.0,
    updatedAt: new Date(),
  };

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private notificationsService: NotificationsService,
  ) {
    const platformRate = this.configService.get<number>('PLATFORM_EXCHANGE_RATE');
    if (typeof platformRate === 'number') {
      this.exchangeRates.platformRate = platformRate;
    }
  }

  async getDashboardStats() {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [
      totalUsers,
      totalOrders,
      pendingOrders,
      completedOrders,
      failedOrders,
      totalRevenueAgg,
      todayOrdersAgg,
      todayRevenueAgg,
      giftCodeStats,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.order.count(),
      this.prisma.order.count({ where: { status: OrderStatus.PENDING } }),
      this.prisma.order.count({ where: { status: OrderStatus.COMPLETED } }),
      this.prisma.order.count({ where: { status: OrderStatus.FAILED } }),
      this.prisma.order.aggregate({
        _sum: { amountPaid: true },
        where: { status: OrderStatus.COMPLETED },
      }),
      this.prisma.order.count({
        where: { status: OrderStatus.COMPLETED, createdAt: { gte: startOfToday } },
      }),
      this.prisma.order.aggregate({
        _sum: { amountPaid: true },
        where: {
          status: OrderStatus.COMPLETED,
          createdAt: { gte: startOfToday },
        },
      }),
      this.prisma.giftCode.groupBy({
        by: ['productId'],
        where: { status: CodeStatus.AVAILABLE },
        _count: { id: true },
      }),
    ]);

    const productIds = giftCodeStats.map((g) => g.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p.name]));
    const threshold = 5;
    const stockAlerts = giftCodeStats
      .filter((g) => g._count.id < threshold)
      .map((g) => ({
        productName: productMap.get(g.productId) ?? 'Unknown',
        available: g._count.id,
        threshold,
      }));

    return {
      totalUsers,
      totalOrders,
      pendingOrders,
      completedOrders,
      failedOrders,
      totalRevenueTnd: totalRevenueAgg._sum.amountPaid ?? 0,
      todayOrders: todayOrdersAgg,
      todayRevenue: todayRevenueAgg._sum.amountPaid ?? 0,
      stockAlerts,
    };
  }

  async getAllUsers(
    pagination: PaginationDto,
    role?: string,
  ): Promise<{ data: any[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, pagination.page ?? 1);
    const limit = Math.min(100, Math.max(1, pagination.limit ?? 20));
    const skip = (page - 1) * limit;
    const where = role && ['BUYER', 'ADMIN'].includes(role)
      ? { role: role as Role }
      : {};

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          walletBalance: true,
          isVerified: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async getUserDetails(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        role: true,
        walletBalance: true,
        isVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const [orders, transactions] = await Promise.all([
      this.prisma.order.findMany({
        where: { userId },
        include: { product: { select: { name: true, slug: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.prisma.transaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    return {
      ...user,
      orders,
      transactions,
    };
  }

  async updateUserRole(userId: string, dto: UpdateUserRoleDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.role === Role.ADMIN && dto.role !== Role.ADMIN) {
      const adminCount = await this.prisma.user.count({
        where: { role: Role.ADMIN },
      });
      if (adminCount <= 1) {
        throw new BadRequestException('Cannot demote the last admin');
      }
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { role: dto.role },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        walletBalance: true,
        isVerified: true,
        createdAt: true,
      },
    });
  }

  async banUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.role === Role.ADMIN) {
      throw new BadRequestException('Cannot ban an admin');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { isVerified: false },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        walletBalance: true,
        isVerified: true,
        createdAt: true,
      },
    });
  }

  async unbanUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { isVerified: true },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        walletBalance: true,
        isVerified: true,
        createdAt: true,
      },
    });
  }

  async getFinancialSummary() {
    const [
      ordersAgg,
      ordersByProduct,
      ordersByBuyer,
    ] = await Promise.all([
      this.prisma.order.aggregate({
        _sum: { amountPaid: true, platformFee: true },
        where: { status: OrderStatus.COMPLETED },
      }),
      this.prisma.order.groupBy({
        by: ['productId'],
        where: { status: OrderStatus.COMPLETED },
        _count: { id: true },
        _sum: { amountPaid: true },
      }),
      this.prisma.order.groupBy({
        by: ['userId'],
        where: { status: OrderStatus.COMPLETED },
        _count: { id: true },
        _sum: { amountPaid: true },
      }),
    ]);

    const totalProcessed = ordersAgg._sum.amountPaid ?? 0;
    const totalRevenue = ordersAgg._sum.platformFee ?? 0;

    const productIds = ordersByProduct.map((o) => o.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p.name]));
    const topProducts = ordersByProduct
      .sort((a, b) => (b._count.id ?? 0) - (a._count.id ?? 0))
      .slice(0, 5)
      .map((o) => ({
        name: productMap.get(o.productId) ?? 'Unknown',
        orders: o._count.id ?? 0,
        revenue: o._sum.amountPaid ?? 0,
      }));

    const buyerIds = ordersByBuyer.map((o) => o.userId);
    const buyers = await this.prisma.user.findMany({
      where: { id: { in: buyerIds } },
      select: { id: true, fullName: true, email: true },
    });
    const buyerMap = new Map(buyers.map((b) => [b.id, b]));
    const topBuyers = ordersByBuyer
      .sort((a, b) => (b._count.id ?? 0) - (a._count.id ?? 0))
      .slice(0, 5)
      .map((o) => {
        const u = buyerMap.get(o.userId);
        return {
          name: u?.fullName ?? u?.email ?? 'Unknown',
          email: u?.email ?? '',
          totalOrders: o._count.id ?? 0,
          totalSpent: o._sum.amountPaid ?? 0,
        };
      });

    return {
      totalProcessed,
      totalRevenue,
      topProducts,
      topBuyers,
    };
  }

  async getActivityLog(pagination: PaginationDto) {
    const limit = Math.min(50, Math.max(1, pagination.limit ?? 50));
    const page = Math.max(1, pagination.page ?? 1);
    const skip = (page - 1) * limit;

    const recentOrders = await this.prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        createdAt: true,
        status: true,
        amountPaid: true,
        product: { select: { name: true } },
        user: { select: { email: true } },
      },
    });

    const data = recentOrders.slice(skip, skip + limit).map((o) => ({
      type: 'order' as const,
      id: o.id,
      createdAt: o.createdAt,
      status: o.status,
      amountPaid: o.amountPaid,
      productName: o.product.name,
      userEmail: o.user.email,
    }));
    const total = recentOrders.length;

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}
