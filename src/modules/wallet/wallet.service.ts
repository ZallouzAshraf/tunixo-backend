import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TransactionType } from '@prisma/client';

@Injectable()
export class WalletService {
  constructor(private prisma: PrismaService) {}

  async getBalance(userId: string): Promise<number> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { walletBalance: true },
    });
    if (!user) return 0;
    return user.walletBalance;
  }

  async credit(
    userId: string,
    amount: number,
    reference?: string,
    description?: string,
  ): Promise<void> {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }
    await this.prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { walletBalance: { increment: amount } },
      });
      await tx.transaction.create({
        data: {
          userId,
          amount,
          type: TransactionType.CREDIT,
          reference: reference ?? undefined,
          description: description ?? undefined,
          balanceAfter: updatedUser.walletBalance,
        },
      });
    });
  }

  async debit(
    userId: string,
    amount: number,
    reference?: string,
    description?: string,
  ): Promise<void> {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { walletBalance: true },
    });
    if (!user || user.walletBalance < amount) {
      throw new BadRequestException('Insufficient wallet balance');
    }
    await this.prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { walletBalance: { decrement: amount } },
      });
      await tx.transaction.create({
        data: {
          userId,
          amount: -amount,
          type: TransactionType.DEBIT,
          reference: reference ?? undefined,
          description: description ?? undefined,
          balanceAfter: updatedUser.walletBalance,
        },
      });
    });
  }

  async getTransactions(userId: string) {
    return this.prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
