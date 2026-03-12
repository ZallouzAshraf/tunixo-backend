import { Module } from '@nestjs/common';
import { GiftCodesController } from './giftcodes.controller';
import { GiftCodesService } from './giftcodes.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [GiftCodesController],
  providers: [GiftCodesService],
  exports: [GiftCodesService],
})
export class GiftCodesModule {}
