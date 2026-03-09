import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { Service } from '@prisma/client';

@Injectable()
export class ServicesService {
  constructor(private prisma: PrismaService) {}

  async findAll(): Promise<Service[]> {
    return this.prisma.service.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async findBySlug(slug: string) {
    const service = await this.prisma.service.findUnique({
      where: { slug, isActive: true },
      include: {
        _count: {
          select: { accounts: { where: { status: 'AVAILABLE' } } },
        },
      },
    });
    if (!service) {
      throw new NotFoundException('Service not found');
    }
    const stockCount = service._count.accounts;
    const { _count, ...rest } = service;
    return { ...rest, stockCount };
  }

  async create(dto: CreateServiceDto): Promise<Service> {
    const existing = await this.prisma.service.findUnique({
      where: { slug: dto.slug },
    });
    if (existing) {
      throw new ConflictException('Service with this slug already exists');
    }
    return this.prisma.service.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        priceTnd: dto.priceTnd,
        priceUsd: dto.priceUsd,
        category: dto.category,
        imageUrl: dto.imageUrl,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(id: string, dto: UpdateServiceDto): Promise<Service> {
    await this.prisma.service.findUniqueOrThrow({ where: { id } });
    return this.prisma.service.update({
      where: { id },
      data: dto,
    });
  }

  async toggleActive(id: string): Promise<Service> {
    const service = await this.prisma.service.findUniqueOrThrow({
      where: { id },
    });
    return this.prisma.service.update({
      where: { id },
      data: { isActive: !service.isActive },
    });
  }
}
