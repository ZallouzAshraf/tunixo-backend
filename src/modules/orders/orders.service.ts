import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SmileOneService } from '../topup/smile-one.service';
import { GiftCodesService } from '../giftcodes/giftcodes.service';
import { CreateOrderDto } from './dto/create-order.dto';
import {
  OrderStatus,
  ServiceType,
  ProductStatus,
  CodeStatus,
} from '@prisma/client';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

const TOPUP_QUEUE = 'topup';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private walletService: WalletService,
    private notificationsService: NotificationsService,
    private smileOneService: SmileOneService,
    private giftcodesService: GiftCodesService,
    @InjectQueue(TOPUP_QUEUE) private topupQueue: Queue,
  ) {}

  async create(userId: string, dto: CreateOrderDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });
    if (!product || product.status !== ProductStatus.ACTIVE) {
      throw new NotFoundException('Product not found');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.walletBalance < product.priceTnd) {
      throw new BadRequestException('Insufficient wallet balance');
    }

    let validation: { valid: boolean; username: string } = { valid: true, username: '' };
    if (product.serviceType === ServiceType.TOPUP) {
      if (!dto.playerId?.trim()) {
        throw new BadRequestException('playerId is required for top-up products');
      }
      if (!product.gameId || !product.productId) {
        throw new BadRequestException('Product is not configured for top-up');
      }
      validation = await this.smileOneService.validatePlayer(
        product.gameId,
        dto.playerId.trim(),
        dto.zoneId?.trim(),
      );
      if (!validation.valid) {
        throw new BadRequestException('Invalid player ID. Please check and try again.');
      }
    }

    const platformFee = 0;
    let order: Awaited<ReturnType<typeof this.prisma.order.create>>;
    let deliveredCode: string | null = null;

    await this.walletService.debit(
      userId,
      product.priceTnd,
      undefined,
      `Order: ${product.name}`,
    );

    try {
      if (product.serviceType === ServiceType.GIFTCARD) {
        const { order: createdOrder, code: reservedCode } = await this.prisma.$transaction(async (tx) => {
          const code = await tx.giftCode.findFirst({
            where: { productId: product.id, status: CodeStatus.AVAILABLE },
            orderBy: { createdAt: 'asc' },
          });
          if (!code) {
            throw new NotFoundException('No available gift code for this product');
          }
          const newOrder = await tx.order.create({
            data: {
              userId,
              productId: product.id,
              amountPaid: product.priceTnd,
              platformFee,
              status: OrderStatus.COMPLETED,
              deliveredCode: code.code,
            },
            include: { product: true, user: true },
          });
          await tx.giftCode.update({
            where: { id: code.id },
            data: { status: CodeStatus.USED, usedAt: new Date(), orderId: newOrder.id },
          });
          return { order: newOrder, code: code.code };
        });
        order = createdOrder;
        deliveredCode = reservedCode;
        this.notificationsService
          .sendGiftCardDelivered(
            user,
            order,
            product,
            deliveredCode,
          )
          .catch(() => {});
      } else {
        const result = await this.smileOneService.createOrder(
          product.gameId!,
          product.productId!,
          dto.playerId!.trim(),
          dto.zoneId?.trim(),
        );
        order = await this.prisma.order.create({
          data: {
            userId,
            productId: product.id,
            playerId: dto.playerId!.trim(),
            zoneId: dto.zoneId?.trim() ?? undefined,
            playerUsername: validation.username,
            amountPaid: product.priceTnd,
            platformFee,
            status: result.success ? OrderStatus.PROCESSING : OrderStatus.FAILED,
            apiReference: result.orderId || undefined,
            apiResponse: result as unknown as object,
            failureReason: result.success ? undefined : result.message,
          },
          include: { product: true, user: true },
        });
        if (!result.success) {
          await this.walletService.credit(
            userId,
            product.priceTnd,
            order.id,
            `Refund: Order failed - ${result.message}`,
          );
          this.notificationsService
            .sendTopupFailed(user, order, product)
            .catch(() => {});
        } else {
          this.notificationsService
            .sendTopupPending(user, order, product)
            .catch(() => {});
          await this.topupQueue.add(
            'check-status',
            { orderId: order.id },
            { delay: 60 * 1000, attempts: 5, backoff: { type: 'exponential', delay: 30000 } },
          );
        }
      }
    } catch (err) {
      await this.walletService.credit(
        userId,
        product.priceTnd,
        undefined,
        `Refund: Order creation failed`,
      ).catch(() => {});
      throw err;
    }

    return {
      order: this.sanitizeOrder(order, deliveredCode),
      autoDelivered: product.serviceType === ServiceType.GIFTCARD,
    };
  }

  private sanitizeOrder(order: { deliveredCode?: string | null; [k: string]: unknown }, deliveredCode: string | null) {
    const out = { ...order };
    if (order.status !== OrderStatus.COMPLETED) {
      delete (out as Record<string, unknown>).deliveredCode;
    } else if (deliveredCode) {
      (out as Record<string, unknown>).deliveredCode = deliveredCode;
    }
    return out;
  }

  async findMyOrders(userId: string) {
    const orders = await this.prisma.order.findMany({
      where: { userId },
      include: { product: { select: { id: true, name: true, slug: true, priceTnd: true, category: true, serviceType: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return orders.map((o) => ({
      ...o,
      deliveredCode: o.status === OrderStatus.COMPLETED ? o.deliveredCode : undefined,
    }));
  }

  async findById(id: string, userId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id },
      include: { product: true },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (order.userId !== userId) {
      throw new ForbiddenException('Not your order');
    }
    return {
      ...order,
      deliveredCode: order.status === OrderStatus.COMPLETED ? order.deliveredCode : undefined,
    };
  }

  async findAllOrders(filters?: {
    status?: OrderStatus;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, filters?.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters?.limit ?? 20));
    const skip = (page - 1) * limit;
    const where = filters?.status ? { status: filters.status } : {};
    const [data, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          user: { select: { id: true, email: true, fullName: true } },
          product: { select: { id: true, name: true, slug: true, priceTnd: true, category: true, serviceType: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);
    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async retryTopup(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { product: true, user: true },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (order.status !== OrderStatus.FAILED) {
      throw new BadRequestException('Only failed TOPUP orders can be retried');
    }
    if (order.product.serviceType !== ServiceType.TOPUP || !order.product.gameId || !order.product.productId || !order.playerId) {
      throw new BadRequestException('Order is not a valid TOPUP order');
    }
    const result = await this.smileOneService.createOrder(
      order.product.gameId,
      order.product.productId,
      order.playerId,
      order.zoneId ?? undefined,
    );
    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: result.success ? OrderStatus.PROCESSING : OrderStatus.FAILED,
        apiReference: result.orderId || undefined,
        apiResponse: result as unknown as object,
        failureReason: result.success ? undefined : result.message,
      },
    });
    if (result.success) {
      await this.topupQueue.add(
        'check-status',
        { orderId },
        { delay: 60 * 1000, attempts: 5, backoff: { type: 'exponential', delay: 30000 } },
      );
    }
    return { success: result.success, message: result.message };
  }
}
