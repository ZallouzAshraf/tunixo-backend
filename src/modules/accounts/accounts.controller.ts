import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Query,
} from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('accounts')
@UseGuards(JwtAuthGuard, AdminGuard)
@Roles(Role.ADMIN)
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post()
  create(@Body() dto: CreateAccountDto) {
    return this.accountsService.create(dto);
  }

  @Post('bulk')
  bulkCreate(
    @Body('serviceId') serviceId: string,
    @Body('credentials') credentials: Record<string, unknown>[],
  ) {
    return this.accountsService.bulkCreate(serviceId, credentials ?? []);
  }

  @Get('stock')
  getStock(@Query('serviceId') serviceId?: string) {
    if (serviceId) {
      return this.accountsService.getStockCount(serviceId).then((count) => ({ serviceId, count }));
    }
    return this.accountsService.getStockLevels();
  }
}
