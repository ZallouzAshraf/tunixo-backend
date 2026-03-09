import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateDepositDto, ConfirmDepositDto, RejectDepositDto } from './dto/create-deposit.dto';
import { DepositStatus } from '@prisma/client';
import { Role } from '@prisma/client';

const DEFAULT_PLATFORM_RATE = 3.0;
const DEFAULT_SELLER_COMMISSION = 0.05;

@Injectable()
export class DepositsService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private walletService: WalletService,
    private notificationsService: NotificationsService,
  ) {}

  private getPlatformRate(): number {
    return Number(
      this.configService.get<string>('PLATFORM_EXCHANGE_RATE', String(DEFAULT_PLATFORM_RATE)),
    ) || DEFAULT_PLATFORM_RATE;
  }

  private getSellerCommission(): number {
    return Number(
      this.configService.get<string>('SELLER_COMMISSION', String(DEFAULT_SELLER_COMMISSION)),
    ) || DEFAULT_SELLER_COMMISSION;
  }

  private computeAmountTnd(amountUsd: number, exchangeRate: number, commissionRate: number): number {
    const rawTnd = amountUsd * exchangeRate;
    const commission = rawTnd * commissionRate;
    return rawTnd - commission;
  }

  async create(sellerId: string, dto: CreateDepositDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: sellerId },
      select: { role: true, email: true },
    });
    if (!user || user.role !== Role.SELLER) {
      throw new ForbiddenException('Only sellers can submit deposits');
    }
    const exchangeRate = this.getPlatformRate();
    const commissionRate = this.getSellerCommission();
    const amountTnd = this.computeAmountTnd(dto.amountUsd, exchangeRate, commissionRate);

    const deposit = await this.prisma.sellerDeposit.create({
      data: {
        sellerId,
        amountUsd: dto.amountUsd,
        amountTnd,
        exchangeRate,
        sellerCommission: commissionRate,
        paymentMethod: dto.paymentMethod,
        proofUrl: dto.proofUrl ?? dto.paymentReference ?? undefined,
        status: DepositStatus.PENDING,
      },
    });

    const adminEmail = this.configService.get<string>('ADMIN_EMAIL')
      ?? this.configService.get<string>('MAIL_USER');
    if (adminEmail) {
      await this.notificationsService
        .sendAdminNewDepositAlert(adminEmail, user.email, dto.amountUsd, dto.paymentMethod)
        .catch(() => {});
    }

    return deposit;
  }

  async findMyDeposits(sellerId: string) {
    return this.prisma.sellerDeposit.findMany({
      where: { sellerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string, userId?: string, role?: string) {
    const deposit = await this.prisma.sellerDeposit.findUnique({
      where: { id },
      include: { seller: { select: { id: true, email: true, fullName: true } } },
    });
    if (!deposit) {
      throw new NotFoundException('Deposit not found');
    }
    if (userId && role !== Role.ADMIN && deposit.sellerId !== userId) {
      throw new ForbiddenException('You can only view your own deposits');
    }
    return deposit;
  }

  async findAllPending() {
    return this.prisma.sellerDeposit.findMany({
      where: { status: DepositStatus.PENDING },
      include: { seller: { select: { id: true, email: true, fullName: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findAll(filters?: { status?: DepositStatus; page?: number; limit?: number }) {
    const page = Math.max(1, filters?.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters?.limit ?? 20));
    const skip = (page - 1) * limit;
    const where = filters?.status ? { status: filters.status } : {};

    const [data, total] = await Promise.all([
      this.prisma.sellerDeposit.findMany({
        where,
        include: { seller: { select: { id: true, email: true, fullName: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.sellerDeposit.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async confirmDeposit(id: string, adminId: string, dto: ConfirmDepositDto) {
    const deposit = await this.prisma.sellerDeposit.findUnique({
      where: { id },
      include: { seller: { select: { id: true, email: true } } },
    });
    if (!deposit) {
      throw new NotFoundException('Deposit not found');
    }
    if (deposit.status !== DepositStatus.PENDING) {
      throw new BadRequestException('Deposit has already been processed');
    }

    const exchangeRate = dto.exchangeRate ?? deposit.exchangeRate;
    const commissionRate = deposit.sellerCommission;
    const amountTnd = this.computeAmountTnd(deposit.amountUsd, exchangeRate, commissionRate);

    const updated = await this.prisma.sellerDeposit.update({
      where: { id },
      data: {
        status: DepositStatus.CONFIRMED,
        confirmedBy: adminId,
        confirmedAt: new Date(),
        exchangeRate,
        amountTnd,
      },
    });

    await this.walletService.credit(
      deposit.sellerId,
      amountTnd,
      deposit.id,
      `Deposit confirmed: $${deposit.amountUsd}`,
    );

    await this.notificationsService
      .sendDepositConfirmed(deposit.seller.email, deposit.amountUsd, amountTnd)
      .catch(() => {});

    return updated;
  }

  async rejectDeposit(id: string, adminId: string, dto: RejectDepositDto) {
    const deposit = await this.prisma.sellerDeposit.findUnique({
      where: { id },
      include: { seller: { select: { email: true } } },
    });
    if (!deposit) {
      throw new NotFoundException('Deposit not found');
    }
    if (deposit.status !== DepositStatus.PENDING) {
      throw new BadRequestException('Deposit has already been processed');
    }

    const updated = await this.prisma.sellerDeposit.update({
      where: { id },
      data: {
        status: DepositStatus.REJECTED,
        confirmedBy: adminId,
        confirmedAt: new Date(),
        rejectionReason: dto.rejectionReason,
      },
    });

    await this.notificationsService
      .sendDepositRejected(deposit.seller.email, deposit.amountUsd, dto.rejectionReason)
      .catch(() => {});

    return updated;
  }

  async getDepositStats() {
    const [totalPending, totalConfirmed, totalRejected, sums] = await Promise.all([
      this.prisma.sellerDeposit.count({ where: { status: DepositStatus.PENDING } }),
      this.prisma.sellerDeposit.count({ where: { status: DepositStatus.CONFIRMED } }),
      this.prisma.sellerDeposit.count({ where: { status: DepositStatus.REJECTED } }),
      this.prisma.sellerDeposit.aggregate({
        where: { status: DepositStatus.CONFIRMED },
        _sum: { amountUsd: true, amountTnd: true },
      }),
    ]);

    return {
      totalPending,
      totalConfirmed,
      totalRejected,
      totalUsdDeposited: sums._sum.amountUsd ?? 0,
      totalTndCredited: sums._sum.amountTnd ?? 0,
    };
  }
}
