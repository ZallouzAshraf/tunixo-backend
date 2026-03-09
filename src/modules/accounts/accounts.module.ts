import { Module } from '@nestjs/common';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { ServicesModule } from '../services/services.module';

@Module({
  imports: [PrismaModule, ServicesModule],
  controllers: [AccountsController],
  providers: [AccountsService],
  exports: [AccountsService],
})
export class AccountsModule {}
