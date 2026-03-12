import { Module } from '@nestjs/common';
import { TopupController } from './topup.controller';
import { SmileOneService } from './smile-one.service';

@Module({
  controllers: [TopupController],
  providers: [SmileOneService],
  exports: [SmileOneService],
})
export class TopupModule {}
