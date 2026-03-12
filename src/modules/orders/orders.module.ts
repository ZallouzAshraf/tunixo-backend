import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { TopupProcessor } from './topup-processor';
import { PrismaModule } from '../../prisma/prisma.module';
import { WalletModule } from '../wallet/wallet.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TopupModule } from '../topup/topup.module';
import { GiftCodesModule } from '../giftcodes/giftcodes.module';
import { TOPUP_QUEUE } from './topup-processor';

@Module({
  imports: [
    PrismaModule,
    WalletModule,
    NotificationsModule,
    TopupModule,
    GiftCodesModule,
    BullModule.registerQueue({ name: TOPUP_QUEUE }),
  ],
  controllers: [OrdersController],
  providers: [OrdersService, TopupProcessor],
  exports: [OrdersService],
})
export class OrdersModule {}
