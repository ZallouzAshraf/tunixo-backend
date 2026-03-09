import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { Service } from '@prisma/client';
import { AccountStatus } from '@prisma/client';

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

export type ServiceWithStock = Service & { stockCount: number };

@Injectable()
export class ServicesService {
  constructor(private prisma: PrismaService) {}

  async findAll(): Promise<ServiceWithStock[]> {
    const [services, countByService] = await Promise.all([
      this.prisma.service.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.account.groupBy({
        by: ['serviceId'],
        where: { status: AccountStatus.AVAILABLE },
        _count: { id: true },
      }),
    ]);
    const countMap = new Map(
      countByService.map((c) => [c.serviceId, c._count.id]),
    );
    return services.map((s) => ({
      ...s,
      stockCount: countMap.get(s.id) ?? 0,
    }));
  }

  async findBySlug(slug: string): Promise<ServiceWithStock> {
    const service = await this.prisma.service.findUnique({
      where: { slug, isActive: true },
    });
    if (!service) {
      throw new NotFoundException('Service not found');
    }
    const stockCount = await this.prisma.account.count({
      where: { serviceId: service.id, status: AccountStatus.AVAILABLE },
    });
    return { ...service, stockCount };
  }

  async create(dto: CreateServiceDto): Promise<Service> {
    const slug = generateSlug(dto.name);
    const existing = await this.prisma.service.findUnique({
      where: { slug },
    });
    if (existing) {
      throw new ConflictException('Service with this slug already exists');
    }
    return this.prisma.service.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        priceTnd: dto.priceTnd,
        priceUsd: dto.priceUsd,
        category: dto.category,
        imageUrl: dto.imageUrl,
        isActive: true,
      },
    });
  }

  async update(id: string, dto: UpdateServiceDto): Promise<Service> {
    const existing = await this.prisma.service.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Service not found');
    }
    const data: Partial<{
      name: string;
      description: string | null;
      priceTnd: number;
      priceUsd: number;
      category: string | null;
      imageUrl: string | null;
    }> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.priceTnd !== undefined) data.priceTnd = dto.priceTnd;
    if (dto.priceUsd !== undefined) data.priceUsd = dto.priceUsd;
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.imageUrl !== undefined) data.imageUrl = dto.imageUrl;

    if (dto.name !== undefined) {
      let slug = generateSlug(dto.name);
      const slugExists = await this.prisma.service.findFirst({
        where: { slug, id: { not: id } },
      });
      if (slugExists) {
        slug = `${slug}-${id.slice(-6)}`;
      }
      (data as Record<string, unknown>).slug = slug;
    }

    return this.prisma.service.update({
      where: { id },
      data,
    });
  }

  async toggleActive(id: string): Promise<Service> {
    const service = await this.prisma.service.findUnique({
      where: { id },
    });
    if (!service) {
      throw new NotFoundException('Service not found');
    }
    return this.prisma.service.update({
      where: { id },
      data: { isActive: !service.isActive },
    });
  }
}
