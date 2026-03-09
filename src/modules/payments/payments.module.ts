import { Module, forwardRef } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { KonnectProvider } from './providers/konnect.provider';
import { WalletModule } from '../wallet/wallet.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [forwardRef(() => WalletModule), NotificationsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, KonnectProvider],
  exports: [PaymentsService],
})
export class PaymentsModule {}
