import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CodeStatus } from '@prisma/client';

@Injectable()
export class GiftCodesService {
  constructor(private prisma: PrismaService) {}

  async bulkCreate(productId: string, codes: string[]) {
    await this.prisma.product.findUniqueOrThrow({
      where: { id: productId },
    });
    const existing = await this.prisma.giftCode.findMany({
      where: { code: { in: codes } },
      select: { code: true },
    });
    const existingSet = new Set(existing.map((e) => e.code));
    const toInsert = codes.filter((c) => !existingSet.has(c));
    if (toInsert.length === 0) {
      return { created: 0, skipped: codes.length, message: 'All codes already exist' };
    }
    await this.prisma.giftCode.createMany({
      data: toInsert.map((code) => ({ productId, code })),
      skipDuplicates: true,
    });
    return {
      created: toInsert.length,
      skipped: codes.length - toInsert.length,
      message: `Created ${toInsert.length} codes`,
    };
  }

  async findAvailable(productId: string) {
    const code = await this.prisma.giftCode.findFirst({
      where: { productId, status: CodeStatus.AVAILABLE },
      orderBy: { createdAt: 'asc' },
    });
    if (!code) {
      throw new NotFoundException('No available gift code for this product');
    }
    return code;
  }

  async markAsUsed(id: string, orderId: string) {
    const code = await this.prisma.giftCode.findUnique({
      where: { id },
    });
    if (!code) {
      throw new NotFoundException('Gift code not found');
    }
    if (code.status === CodeStatus.USED) {
      throw new ConflictException('Gift code already used');
    }
    return this.prisma.giftCode.update({
      where: { id },
      data: {
        status: CodeStatus.USED,
        usedAt: new Date(),
        orderId,
      },
    });
  }

  async getStats(): Promise<{ productId: string; productName: string; available: number }[]> {
    const products = await this.prisma.product.findMany({
      where: { serviceType: 'GIFTCARD' },
      select: { id: true, name: true },
    });
    const counts = await Promise.all(
      products.map(async (p) => {
        const available = await this.prisma.giftCode.count({
          where: { productId: p.id, status: CodeStatus.AVAILABLE },
        });
        return { productId: p.id, productName: p.name, available };
      }),
    );
    return counts;
  }

  async findAll(filters?: { productId?: string; status?: CodeStatus }) {
    const where: { productId?: string; status?: CodeStatus } = {};
    if (filters?.productId) where.productId = filters.productId;
    if (filters?.status) where.status = filters.status;
    return this.prisma.giftCode.findMany({
      where,
      include: { product: { select: { id: true, name: true, slug: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
