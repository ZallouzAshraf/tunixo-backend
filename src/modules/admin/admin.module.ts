import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrdersModule } from '../orders/orders.module';
import { DepositsModule } from '../deposits/deposits.module';
import { WithdrawalsModule } from '../withdrawals/withdrawals.module';

@Module({
  imports: [
    PrismaModule,
    UsersModule,
    NotificationsModule,
    OrdersModule,
    DepositsModule,
    WithdrawalsModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
