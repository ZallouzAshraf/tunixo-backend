import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { OrdersService } from '../orders/orders.service';
import { DepositsService } from '../deposits/deposits.service';
import { WithdrawalsService } from '../withdrawals/withdrawals.service';
import {
  PaginationDto,
  UpdateUserRoleDto,
  UpdateExchangeRateDto,
  TopupPlatformReserveDto,
} from './dto/admin.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { Role, OrderStatus } from '@prisma/client';
import { DepositStatus } from '@prisma/client';

@ApiTags('Admin')
@ApiBearerAuth('access-token')
@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
@Roles(Role.ADMIN)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly ordersService: OrdersService,
    private readonly depositsService: DepositsService,
    private readonly withdrawalsService: WithdrawalsService,
  ) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get dashboard statistics' })
  getDashboard() {
    return this.adminService.getDashboardStats();
  }

  @Get('users')
  @ApiOperation({ summary: 'Get all users paginated' })
  @ApiQuery({ name: 'role', required: false, enum: ['BUYER', 'SELLER', 'ADMIN'] })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getAllUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('role') role?: string,
  ) {
    const pagination: PaginationDto = {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    };
    return this.adminService.getAllUsers(pagination, role);
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get user full details' })
  @ApiResponse({ status: 404, description: 'User not found' })
  getUserDetails(@Param('id') id: string) {
    return this.adminService.getUserDetails(id);
  }

  @Patch('users/:id/role')
  @ApiOperation({ summary: 'Update user role' })
  @ApiResponse({ status: 400, description: 'Cannot demote last admin' })
  updateUserRole(
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    return this.adminService.updateUserRole(id, dto);
  }

  @Patch('users/:id/ban')
  @ApiOperation({ summary: 'Ban a user' })
  @ApiResponse({ status: 400, description: 'Cannot ban admin' })
  banUser(@Param('id') id: string) {
    return this.adminService.banUser(id);
  }

  @Patch('users/:id/unban')
  @ApiOperation({ summary: 'Unban a user' })
  unbanUser(@Param('id') id: string) {
    return this.adminService.unbanUser(id);
  }

  @Get('reserve')
  @ApiOperation({ summary: 'Get platform reserve' })
  getPlatformReserve() {
    return this.adminService.getPlatformReserve();
  }

  @Post('reserve/topup')
  @ApiOperation({ summary: 'Add to platform reserve' })
  topupPlatformReserve(@Body() dto: TopupPlatformReserveDto) {
    return this.adminService.topupPlatformReserve(dto);
  }

  @Patch('exchange-rate')
  @ApiOperation({ summary: 'Update exchange rate' })
  updateExchangeRate(@Body() dto: UpdateExchangeRateDto) {
    return this.adminService.updateExchangeRate(dto);
  }

  @Get('financial')
  @ApiOperation({ summary: 'Get financial summary' })
  getFinancialSummary() {
    return this.adminService.getFinancialSummary();
  }

  @Get('activity')
  @ApiOperation({ summary: 'Get recent activity log' })
  getActivityLog(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pagination: PaginationDto = {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
    };
    return this.adminService.getActivityLog(pagination);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Dashboard statistics (alias)' })
  getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  @Get('orders/stats')
  @ApiOperation({ summary: 'Get order statistics — Admin' })
  @ApiResponse({ status: 200, description: 'Order stats' })
  getOrderStats() {
    return this.ordersService.getOrderStats();
  }

  @Get('orders')
  @ApiOperation({ summary: 'Get all orders — Admin' })
  getAllOrders(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: OrderStatus,
  ) {
    return this.ordersService.findAllOrders({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      status,
    });
  }

  @Post('orders/:id/deliver')
  @ApiOperation({ summary: 'Mark order as delivered — Admin' })
  @ApiResponse({ status: 200, description: 'Order marked as delivered' })
  markOrderDelivered(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.ordersService.markAsDelivered(id, user.userId);
  }

  @Get('deposits/pending')
  @ApiOperation({ summary: 'Get pending deposits — Admin' })
  getPendingDeposits() {
    return this.depositsService.findAllPending();
  }

  @Get('deposits')
  @ApiOperation({ summary: 'Get all deposits with filters — Admin' })
  getAllDeposits(
    @Query('status') status?: DepositStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.depositsService.findAll({
      status,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('withdrawals/pending')
  @ApiOperation({ summary: 'Get pending withdrawals — Admin' })
  getPendingWithdrawals() {
    return this.withdrawalsService.findAllPending();
  }

  @Get('withdrawals')
  @ApiOperation({ summary: 'Get all withdrawals — Admin' })
  getAllWithdrawals() {
    return this.withdrawalsService.findAll();
  }
}
