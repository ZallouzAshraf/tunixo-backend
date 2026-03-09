import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { AccountStatus } from '@prisma/client';

@Injectable()
export class AccountsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateAccountDto) {
    await this.prisma.service.findUniqueOrThrow({
      where: { id: dto.serviceId },
    });
    return this.prisma.account.create({
      data: {
        serviceId: dto.serviceId,
        credentials: dto.credentials as object,
        status: AccountStatus.AVAILABLE,
      },
    });
  }

  async findAvailable(serviceId: string) {
    return this.prisma.account.findFirst({
      where: { serviceId, status: AccountStatus.AVAILABLE },
    });
  }

  async getStockCount(serviceId: string): Promise<number> {
    return this.prisma.account.count({
      where: { serviceId, status: AccountStatus.AVAILABLE },
    });
  }

  async getStockLevels(): Promise<{ serviceId: string; count: number }[]> {
    const accounts = await this.prisma.account.groupBy({
      by: ['serviceId'],
      where: { status: AccountStatus.AVAILABLE },
      _count: { id: true },
    });
    return accounts.map((a) => ({ serviceId: a.serviceId, count: a._count.id }));
  }

  async bulkCreate(
    serviceId: string,
    credentialsList: Record<string, unknown>[],
  ) {
    await this.prisma.service.findUniqueOrThrow({
      where: { id: serviceId },
    });
    const created = await this.prisma.account.createManyAndReturn({
      data: credentialsList.map((credentials) => ({
        serviceId,
        credentials: credentials as object,
        status: AccountStatus.AVAILABLE,
      })),
    });
    return { count: created.length, accounts: created };
  }
}
