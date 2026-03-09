import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  PaginationDto,
  UpdateUserRoleDto,
  UpdateExchangeRateDto,
  TopupPlatformReserveDto,
} from './dto/admin.dto';
import {
  Role,
  OrderStatus,
  DepositStatus,
  WithdrawalStatus,
  AccountStatus,
} from '@prisma/client';

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
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      usersTotal,
      buyersCount,
      sellersCount,
      adminsCount,
      newUsersToday,
      newUsersThisMonth,
      ordersTotal,
      ordersActive,
      ordersPending,
      ordersFailed,
      ordersForRevenue,
      revenueTodayOrders,
      revenueThisMonthOrders,
      depositsTotal,
      depositsPending,
      depositsConfirmed,
      depositsSums,
      withdrawalsTotal,
      withdrawalsPending,
      withdrawalsCompleted,
      withdrawalsSum,
      buyerWalletSum,
      sellerWalletSum,
      reserveRecord,
      servicesTotal,
      servicesActive,
      stockCount,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { role: Role.BUYER } }),
      this.prisma.user.count({ where: { role: Role.SELLER } }),
      this.prisma.user.count({ where: { role: Role.ADMIN } }),
      this.prisma.user.count({ where: { createdAt: { gte: startOfToday } } }),
      this.prisma.user.count({ where: { createdAt: { gte: startOfMonth } } }),
      this.prisma.order.count(),
      this.prisma.order.count({ where: { status: OrderStatus.ACTIVE } }),
      this.prisma.order.count({ where: { status: OrderStatus.PENDING } }),
      this.prisma.order.count({ where: { status: OrderStatus.FAILED } }),
      this.prisma.order.aggregate({
        _sum: { platformFee: true },
        where: { status: OrderStatus.ACTIVE },
      }),
      this.prisma.order.aggregate({
        _sum: { platformFee: true },
        where: {
          status: OrderStatus.ACTIVE,
          createdAt: { gte: startOfToday },
        },
      }),
      this.prisma.order.aggregate({
        _sum: { platformFee: true },
        where: {
          status: OrderStatus.ACTIVE,
          createdAt: { gte: startOfMonth },
        },
      }),
      this.prisma.sellerDeposit.count(),
      this.prisma.sellerDeposit.count({ where: { status: DepositStatus.PENDING } }),
      this.prisma.sellerDeposit.count({ where: { status: DepositStatus.CONFIRMED } }),
      this.prisma.sellerDeposit.aggregate({
        _sum: { amountUsd: true, amountTnd: true },
        where: { status: DepositStatus.CONFIRMED },
      }),
      this.prisma.sellerWithdrawal.count(),
      this.prisma.sellerWithdrawal.count({ where: { status: WithdrawalStatus.PENDING } }),
      this.prisma.sellerWithdrawal.count({ where: { status: WithdrawalStatus.COMPLETED } }),
      this.prisma.sellerWithdrawal.aggregate({
        _sum: { amountTnd: true },
        where: { status: WithdrawalStatus.COMPLETED },
      }),
      this.prisma.user.aggregate({
        _sum: { walletBalance: true },
        where: { role: Role.BUYER },
      }),
      this.prisma.user.aggregate({
        _sum: { walletBalance: true },
        where: { role: Role.SELLER },
      }),
      this.prisma.platformReserve.findFirst(),
      this.prisma.service.count(),
      this.prisma.service.count({ where: { isActive: true } }),
      this.prisma.account.count({ where: { status: AccountStatus.AVAILABLE } }),
    ]);

    return {
      users: {
        total: usersTotal,
        buyers: buyersCount,
        sellers: sellersCount,
        newToday: newUsersToday,
        newThisMonth: newUsersThisMonth,
      },
      orders: {
        total: ordersTotal,
        active: ordersActive,
        pending: ordersPending,
        failed: ordersFailed,
        totalRevenue: ordersForRevenue._sum.platformFee ?? 0,
        revenueToday: revenueTodayOrders._sum.platformFee ?? 0,
        revenueThisMonth: revenueThisMonthOrders._sum.platformFee ?? 0,
      },
      deposits: {
        total: depositsTotal,
        pending: depositsPending,
        confirmed: depositsConfirmed,
        totalUsd: depositsSums._sum.amountUsd ?? 0,
        totalTnd: depositsSums._sum.amountTnd ?? 0,
      },
      withdrawals: {
        total: withdrawalsTotal,
        pending: withdrawalsPending,
        completed: withdrawalsCompleted,
        totalTnd: withdrawalsSum._sum.amountTnd ?? 0,
      },
      wallet: {
        totalBuyerBalance: buyerWalletSum._sum.walletBalance ?? 0,
        totalSellerBalance: sellerWalletSum._sum.walletBalance ?? 0,
      },
      reserve: {
        currentUsd: reserveRecord?.amountUsd ?? 0,
      },
      services: {
        total: servicesTotal,
        active: servicesActive,
        totalStock: stockCount,
      },
    };
  }

  async getAllUsers(
    pagination: PaginationDto,
    role?: string,
  ): Promise<{ data: any[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, pagination.page ?? 1);
    const limit = Math.min(100, Math.max(1, pagination.limit ?? 20));
    const skip = (page - 1) * limit;
    const where = role && ['BUYER', 'SELLER', 'ADMIN'].includes(role)
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

    const isSeller = user.role === Role.SELLER;
    const [orders, transactions, deposits, withdrawals] = await Promise.all([
      this.prisma.order.findMany({
        where: { userId },
        include: { service: { select: { name: true, slug: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.prisma.transaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      isSeller
        ? this.prisma.sellerDeposit.findMany({
            where: { sellerId: userId },
            orderBy: { createdAt: 'desc' },
          })
        : Promise.resolve([]),
      isSeller
        ? this.prisma.sellerWithdrawal.findMany({
            where: { sellerId: userId },
            orderBy: { createdAt: 'desc' },
          })
        : Promise.resolve([]),
    ]);

    return {
      ...user,
      orders,
      transactions,
      deposits,
      withdrawals,
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

  async getPlatformReserve() {
    let reserve = await this.prisma.platformReserve.findFirst();
    if (!reserve) {
      reserve = await this.prisma.platformReserve.create({
        data: { amountUsd: 0 },
      });
    }
    return reserve;
  }

  async topupPlatformReserve(dto: TopupPlatformReserveDto) {
    let reserve = await this.prisma.platformReserve.findFirst();
    if (!reserve) {
      reserve = await this.prisma.platformReserve.create({
        data: { amountUsd: 0 },
      });
    }
    return this.prisma.platformReserve.update({
      where: { id: reserve.id },
      data: { amountUsd: { increment: dto.amountUsd } },
    });
  }

  async updateExchangeRate(dto: UpdateExchangeRateDto) {
    this.exchangeRates = {
      officialRate: dto.officialRate,
      platformRate: dto.platformRate,
      updatedAt: new Date(),
    };
    return {
      officialRate: this.exchangeRates.officialRate,
      platformRate: this.exchangeRates.platformRate,
      updatedAt: this.exchangeRates.updatedAt,
    };
  }

  async getFinancialSummary() {
    const [
      ordersAgg,
      depositsAgg,
      withdrawalsAgg,
      ordersByService,
      depositsBySeller,
      ordersByBuyer,
    ] = await Promise.all([
      this.prisma.order.aggregate({
        _sum: { amountPaid: true, platformFee: true },
        where: { status: OrderStatus.ACTIVE },
      }),
      this.prisma.sellerDeposit.aggregate({
        _sum: { amountUsd: true, amountTnd: true },
        where: { status: DepositStatus.CONFIRMED },
      }),
      this.prisma.sellerWithdrawal.aggregate({
        _sum: { amountTnd: true },
        where: { status: WithdrawalStatus.COMPLETED },
      }),
      this.prisma.order.groupBy({
        by: ['serviceId'],
        where: { status: OrderStatus.ACTIVE },
        _count: { id: true },
        _sum: { platformFee: true },
      }),
      this.prisma.sellerDeposit.groupBy({
        by: ['sellerId'],
        where: { status: DepositStatus.CONFIRMED },
        _sum: { amountUsd: true, amountTnd: true },
      }),
      this.prisma.order.groupBy({
        by: ['userId'],
        where: { status: OrderStatus.ACTIVE },
        _count: { id: true },
        _sum: { amountPaid: true },
      }),
    ]);

    const totalProcessed = ordersAgg._sum.amountPaid ?? 0;
    const totalRevenue = ordersAgg._sum.platformFee ?? 0;
    const totalDepositsUsd = depositsAgg._sum.amountUsd ?? 0;
    const totalWithdrawnTnd = withdrawalsAgg._sum.amountTnd ?? 0;
    const netPosition = totalRevenue; // simplified: revenue - expenses

    const serviceIds = ordersByService.map((o) => o.serviceId);
    const services = await this.prisma.service.findMany({
      where: { id: { in: serviceIds } },
      select: { id: true, name: true },
    });
    const serviceMap = new Map(services.map((s) => [s.id, s.name]));
    const topServices = ordersByService
      .sort((a, b) => (b._count.id ?? 0) - (a._count.id ?? 0))
      .slice(0, 5)
      .map((o) => ({
        name: serviceMap.get(o.serviceId) ?? 'Unknown',
        orders: o._count.id ?? 0,
        revenue: o._sum.platformFee ?? 0,
      }));

    const sellerIds = depositsBySeller.map((d) => d.sellerId);
    const sellers = await this.prisma.user.findMany({
      where: { id: { in: sellerIds } },
      select: { id: true, fullName: true, email: true },
    });
    const sellerMap = new Map(sellers.map((s) => [s.id, s]));
    const topSellers = depositsBySeller
      .sort((a, b) => (b._sum.amountUsd ?? 0) - (a._sum.amountUsd ?? 0))
      .slice(0, 5)
      .map((d) => {
        const s = sellerMap.get(d.sellerId);
        return {
          name: s?.fullName ?? s?.email ?? 'Unknown',
          email: s?.email ?? '',
          totalUsd: d._sum.amountUsd ?? 0,
          totalTnd: d._sum.amountTnd ?? 0,
        };
      });

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
      totalDepositsUsd,
      totalWithdrawnTnd,
      netPosition,
      topServices,
      topSellers,
      topBuyers,
    };
  }

  async getActivityLog(pagination: PaginationDto) {
    const limit = Math.min(50, Math.max(1, pagination.limit ?? 50));
    const page = Math.max(1, pagination.page ?? 1);
    const skip = (page - 1) * limit;

    const [recentOrders, recentDeposits, recentWithdrawals] = await Promise.all([
      this.prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          createdAt: true,
          status: true,
          amountPaid: true,
          service: { select: { name: true } },
          user: { select: { email: true } },
        },
      }),
      this.prisma.sellerDeposit.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          createdAt: true,
          status: true,
          amountUsd: true,
          amountTnd: true,
          seller: { select: { email: true } },
        },
      }),
      this.prisma.sellerWithdrawal.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          createdAt: true,
          status: true,
          amountTnd: true,
          method: true,
          seller: { select: { email: true } },
        },
      }),
    ]);

    const orderItems = recentOrders.map((o) => ({
      type: 'order' as const,
      id: o.id,
      createdAt: o.createdAt,
      status: o.status,
      amountPaid: o.amountPaid,
      serviceName: o.service.name,
      userEmail: o.user.email,
    }));
    const depositItems = recentDeposits.map((d) => ({
      type: 'deposit' as const,
      id: d.id,
      createdAt: d.createdAt,
      status: d.status,
      amountUsd: d.amountUsd,
      amountTnd: d.amountTnd,
      sellerEmail: d.seller.email,
    }));
    const withdrawalItems = recentWithdrawals.map((w) => ({
      type: 'withdrawal' as const,
      id: w.id,
      createdAt: w.createdAt,
      status: w.status,
      amountTnd: w.amountTnd,
      method: w.method,
      sellerEmail: w.seller.email,
    }));

    const combined = [...orderItems, ...depositItems, ...withdrawalItems].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
    const total = combined.length;
    const data = combined.slice(skip, skip + limit);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}
