import {
  Controller,
  Get,
  Post,
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
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { OrdersService } from '../orders/orders.service';
import { FulfillOrderDto } from '../orders/dto/create-order.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { Role, OrderStatus } from '@prisma/client';

@ApiTags('Admin')
@ApiBearerAuth('access-token')
@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
@Roles(Role.ADMIN)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly ordersService: OrdersService,
  ) {}

  @Get('stats')
  @ApiOperation({ summary: 'Dashboard statistics' })
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

  @Get('users')
  @ApiOperation({ summary: 'Get all users — Admin' })
  getAllUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getAllUsers({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Post('orders/:id/fulfill')
  @ApiOperation({ summary: 'Manually fulfill pending order' })
  @ApiResponse({ status: 200, description: 'Order fulfilled' })
  fulfillOrder(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: FulfillOrderDto,
  ) {
    return this.ordersService.fulfillOrder(id, user.userId, dto);
  }
}
