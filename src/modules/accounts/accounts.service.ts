import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAccountDto, BulkCreateAccountDto } from './dto/create-account.dto';
import { AccountStatus } from '@prisma/client';

export interface StockLevel {
  serviceId: string;
  serviceName: string;
  available: number;
  used: number;
  total: number;
}

@Injectable()
export class AccountsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateAccountDto) {
    const service = await this.prisma.service.findUnique({
      where: { id: dto.serviceId },
    });
    if (!service) {
      throw new NotFoundException('Service not found');
    }
    return this.prisma.account.create({
      data: {
        serviceId: dto.serviceId,
        accountEmail: dto.accountEmail ?? undefined,
        credentials: dto.credentials as object,
        status: AccountStatus.AVAILABLE,
      },
    });
  }

  async bulkCreate(dto: BulkCreateAccountDto): Promise<{ created: number }> {
    const service = await this.prisma.service.findUnique({
      where: { id: dto.serviceId },
    });
    if (!service) {
      throw new NotFoundException('Service not found');
    }
    const items = (dto.accounts ?? dto.credentials ?? []) as object[];
    if (!items.length) {
      throw new BadRequestException('At least one account (credentials or accounts) is required');
    }
    const result = await this.prisma.account.createMany({
      data: items.map((credentials) => ({
        serviceId: dto.serviceId,
        credentials,
        status: AccountStatus.AVAILABLE,
      })),
    });
    return { created: result.count };
  }

  async findAll() {
    return this.prisma.account.findMany({
      include: { service: { select: { id: true, name: true, slug: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async delete(id: string) {
    const account = await this.prisma.account.findUnique({
      where: { id },
    });
    if (!account) {
      throw new NotFoundException('Account not found');
    }
    if (account.status !== AccountStatus.AVAILABLE) {
      throw new BadRequestException('Only AVAILABLE accounts can be deleted');
    }
    await this.prisma.account.delete({ where: { id } });
    return { deleted: true };
  }

  async findAvailable(serviceId: string) {
    return this.prisma.account.findFirst({
      where: { serviceId, status: AccountStatus.AVAILABLE },
    });
  }

  async getStockLevels(): Promise<StockLevel[]> {
    const rows = await this.prisma.account.groupBy({
      by: ['serviceId', 'status'],
      _count: { id: true },
    });

    const byService = new Map<
      string,
      { available: number; used: number; reserved: number; total: number }
    >();

    for (const row of rows) {
      const current = byService.get(row.serviceId) ?? {
        available: 0,
        used: 0,
        reserved: 0,
        total: 0,
      };
      const count = row._count.id;
      current.total += count;
      if (row.status === AccountStatus.AVAILABLE) current.available += count;
      else if (row.status === AccountStatus.USED) current.used += count;
      else current.reserved += count;
      byService.set(row.serviceId, current);
    }

    const serviceIds = [...byService.keys()];
    if (serviceIds.length === 0) return [];

    const services = await this.prisma.service.findMany({
      where: { id: { in: serviceIds } },
      select: { id: true, name: true },
    });
    const nameByServiceId = new Map(services.map((s) => [s.id, s.name]));

    return serviceIds.map((serviceId) => {
      const counts = byService.get(serviceId)!;
      return {
        serviceId,
        serviceName: nameByServiceId.get(serviceId) ?? 'Unknown',
        available: counts.available,
        used: counts.used,
        total: counts.total,
      };
    });
  }
}
