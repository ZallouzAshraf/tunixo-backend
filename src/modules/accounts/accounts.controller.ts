import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AccountsService } from './accounts.service';
import { CreateAccountDto, BulkCreateAccountDto } from './dto/create-account.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';

@ApiTags('Accounts')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post()
  @ApiOperation({ summary: 'Add single account to stock' })
  @ApiResponse({ status: 201, description: 'Account added' })
  create(@Body() dto: CreateAccountDto) {
    return this.accountsService.create(dto);
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Add multiple accounts to stock' })
  @ApiResponse({ status: 201, description: 'Accounts added' })
  bulkCreate(@Body() dto: BulkCreateAccountDto) {
    return this.accountsService.bulkCreate(dto);
  }

  @Get('stock')
  @ApiOperation({ summary: 'Get stock levels per service' })
  @ApiResponse({ status: 200, description: 'Stock levels' })
  getStockLevels() {
    return this.accountsService.getStockLevels();
  }

  @Get()
  @ApiOperation({ summary: 'Get all accounts — Admin' })
  @ApiResponse({ status: 200, description: 'All accounts' })
  findAll() {
    return this.accountsService.findAll();
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete account (AVAILABLE only)' })
  @ApiResponse({ status: 200, description: 'Account deleted' })
  @ApiResponse({ status: 400, description: 'Only AVAILABLE accounts can be deleted' })
  delete(@Param('id') id: string) {
    return this.accountsService.delete(id);
  }
}
