import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductStatus } from '@prisma/client';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async findAll(category?: string) {
    const where: { status: ProductStatus; category?: string } = {
      status: ProductStatus.ACTIVE,
    };
    if (category) {
      where.category = category;
    }
    return this.prisma.product.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async findBySlug(slug: string) {
    const product = await this.prisma.product.findUnique({
      where: { slug, status: ProductStatus.ACTIVE },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }

  async create(dto: CreateProductDto) {
    const existing = await this.prisma.product.findUnique({
      where: { slug: dto.slug },
    });
    if (existing) {
      throw new ConflictException('Product with this slug already exists');
    }
    return this.prisma.product.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        imageUrl: dto.imageUrl,
        category: dto.category,
        serviceType: dto.serviceType,
        gameId: dto.gameId,
        productId: dto.productId,
        priceTnd: dto.priceTnd,
        costUsd: dto.costUsd,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.prisma.product.findUniqueOrThrow({
      where: { id },
    });
    if (dto.slug) {
      const existing = await this.prisma.product.findFirst({
        where: { slug: dto.slug, id: { not: id } },
      });
      if (existing) {
        throw new ConflictException('Product with this slug already exists');
      }
    }
    return this.prisma.product.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.slug !== undefined && { slug: dto.slug }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.serviceType !== undefined && { serviceType: dto.serviceType }),
        ...(dto.gameId !== undefined && { gameId: dto.gameId }),
        ...(dto.productId !== undefined && { productId: dto.productId }),
        ...(dto.priceTnd !== undefined && { priceTnd: dto.priceTnd }),
        ...(dto.costUsd !== undefined && { costUsd: dto.costUsd }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
    });
  }

  async remove(id: string) {
    await this.prisma.product.findUniqueOrThrow({
      where: { id },
    });
    return this.prisma.product.delete({
      where: { id },
    });
  }
}
