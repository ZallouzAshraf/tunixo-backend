import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ConfigService } from '@nestjs/config';
import {
  CreateWithdrawalDto,
  ProcessWithdrawalDto,
  RejectWithdrawalDto,
} from './dto/create-withdrawal.dto';
import { Role } from '@prisma/client';
import { WithdrawalStatus } from '@prisma/client';
import { TransactionType } from '@prisma/client';

@Injectable()
export class WithdrawalsService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private notificationsService: NotificationsService,
  ) {}

  async create(sellerId: string, dto: CreateWithdrawalDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: sellerId },
      select: { role: true, email: true, fullName: true, walletBalance: true },
    });
    if (!user || user.role !== Role.SELLER) {
      throw new ForbiddenException('Only sellers can request withdrawals');
    }
    if (user.walletBalance < dto.amountTnd) {
      throw new BadRequestException('Insufficient balance');
    }
    const pending = await this.prisma.sellerWithdrawal.findFirst({
      where: { sellerId, status: WithdrawalStatus.PENDING },
    });
    if (pending) {
      throw new BadRequestException(
        'You already have a pending withdrawal request',
      );
    }

    const withdrawal = await this.prisma.$transaction(async (tx) => {
      const w = await tx.sellerWithdrawal.create({
        data: {
          sellerId,
          amountTnd: dto.amountTnd,
          method: dto.method,
          methodDetails: dto.methodDetails as object,
          status: WithdrawalStatus.PENDING,
        },
      });
      const updatedUser = await tx.user.update({
        where: { id: sellerId },
        data: { walletBalance: { decrement: dto.amountTnd } },
      });
      await tx.transaction.create({
        data: {
          userId: sellerId,
          amount: -dto.amountTnd,
          type: TransactionType.WITHDRAWAL,
          reference: w.id,
          description: 'Withdrawal reserved',
          balanceAfter: updatedUser.walletBalance,
        },
      });
      return w;
    });

    await this.notificationsService
      .sendWithdrawalRequested({
        email: user!.email,
        fullName: user!.fullName ?? '',
        amountTnd: dto.amountTnd,
        method: dto.method,
        withdrawalId: withdrawal.id,
      })
      .catch(() => {});
    await this.notificationsService
      .notifyAdminNewWithdrawal({
        sellerEmail: user!.email,
        sellerName: user!.fullName ?? user!.email,
        amountTnd: dto.amountTnd,
        method: dto.method,
        methodDetails: dto.methodDetails,
        withdrawalId: withdrawal.id,
      })
      .catch(() => {});

    return withdrawal;
  }

  async findMyWithdrawals(sellerId: string) {
    return this.prisma.sellerWithdrawal.findMany({
      where: { sellerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAllPending() {
    return this.prisma.sellerWithdrawal.findMany({
      where: { status: WithdrawalStatus.PENDING },
      include: {
        seller: {
          select: { id: true, email: true, fullName: true, phone: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findAll() {
    return this.prisma.sellerWithdrawal.findMany({
      include: {
        seller: {
          select: { id: true, email: true, fullName: true, phone: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async completeWithdrawal(
    id: string,
    adminId: string,
    _dto: ProcessWithdrawalDto,
  ) {
    const withdrawal = await this.prisma.sellerWithdrawal.findUnique({
      where: { id },
      include: { seller: { select: { email: true, fullName: true } } },
    });
    if (!withdrawal) {
      throw new NotFoundException('Withdrawal not found');
    }
    if (withdrawal.status !== WithdrawalStatus.PENDING) {
      throw new BadRequestException('Withdrawal has already been processed');
    }

    const updated = await this.prisma.sellerWithdrawal.update({
      where: { id },
      data: {
        status: WithdrawalStatus.COMPLETED,
        processedBy: adminId,
        processedAt: new Date(),
      },
    });

    await this.notificationsService
      .sendWithdrawalCompleted({
        email: withdrawal.seller.email,
        fullName: withdrawal.seller.fullName ?? '',
        amountTnd: withdrawal.amountTnd,
        method: withdrawal.method,
      })
      .catch(() => {});

    return updated;
  }

  async rejectWithdrawal(id: string, adminId: string, dto: RejectWithdrawalDto) {
    const withdrawal = await this.prisma.sellerWithdrawal.findUnique({
      where: { id },
      include: { seller: { select: { id: true, email: true, fullName: true } } },
    });
    if (!withdrawal) {
      throw new NotFoundException('Withdrawal not found');
    }
    if (withdrawal.status !== WithdrawalStatus.PENDING) {
      throw new BadRequestException('Withdrawal has already been processed');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.sellerWithdrawal.update({
        where: { id },
        data: {
          status: WithdrawalStatus.REJECTED,
          processedBy: adminId,
          processedAt: new Date(),
          rejectionReason: dto.rejectionReason,
        },
      });
      const updatedUser = await tx.user.update({
        where: { id: withdrawal.sellerId },
        data: { walletBalance: { increment: withdrawal.amountTnd } },
      });
      await tx.transaction.create({
        data: {
          userId: withdrawal.sellerId,
          amount: withdrawal.amountTnd,
          type: TransactionType.CREDIT,
          reference: id,
          description: 'Withdrawal rejected — refunded',
          balanceAfter: updatedUser.walletBalance,
        },
      });
    });

    await this.notificationsService
      .sendWithdrawalRejected({
        email: withdrawal.seller.email,
        fullName: withdrawal.seller.fullName ?? '',
        amountTnd: withdrawal.amountTnd,
        reason: dto.rejectionReason,
      })
      .catch(() => {});

    return this.prisma.sellerWithdrawal.findUnique({
      where: { id },
    });
  }

  async getWithdrawalStats() {
    const [totalPending, totalCompleted, totalRejected, completedSum, pendingSum] =
      await Promise.all([
        this.prisma.sellerWithdrawal.count({
          where: { status: WithdrawalStatus.PENDING },
        }),
        this.prisma.sellerWithdrawal.count({
          where: { status: WithdrawalStatus.COMPLETED },
        }),
        this.prisma.sellerWithdrawal.count({
          where: { status: WithdrawalStatus.REJECTED },
        }),
        this.prisma.sellerWithdrawal.aggregate({
          where: { status: WithdrawalStatus.COMPLETED },
          _sum: { amountTnd: true },
        }),
        this.prisma.sellerWithdrawal.aggregate({
          where: { status: WithdrawalStatus.PENDING },
          _sum: { amountTnd: true },
        }),
      ]);

    return {
      totalPending,
      totalCompleted,
      totalRejected,
      totalTndWithdrawn: completedSum._sum.amountTnd ?? 0,
      totalTndPending: pendingSum._sum.amountTnd ?? 0,
    };
  }
}
