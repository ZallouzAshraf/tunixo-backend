import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { WithdrawalsService } from './withdrawals.service';
import {
  CreateWithdrawalDto,
  ProcessWithdrawalDto,
  RejectWithdrawalDto,
} from './dto/create-withdrawal.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@ApiTags('Withdrawals')
@Controller('withdrawals')
export class WithdrawalsController {
  constructor(private readonly withdrawalsService: WithdrawalsService) {}

  @Post()
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Request TND withdrawal' })
  @ApiResponse({ status: 201, description: 'Withdrawal requested' })
  @ApiResponse({ status: 400, description: 'Insufficient balance' })
  @ApiResponse({ status: 403, description: 'Not a seller' })
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateWithdrawalDto,
  ) {
    return this.withdrawalsService.create(user.userId, dto);
  }

  @Get('my')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get my withdrawal history' })
  findMyWithdrawals(@CurrentUser() user: CurrentUserPayload) {
    return this.withdrawalsService.findMyWithdrawals(user.userId);
  }

  @Get('pending')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get pending withdrawals — Admin' })
  findAllPending() {
    return this.withdrawalsService.findAllPending();
  }

  @Get('stats')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Withdrawal statistics — Admin' })
  getWithdrawalStats() {
    return this.withdrawalsService.getWithdrawalStats();
  }

  @Get()
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get all withdrawals — Admin' })
  findAll() {
    return this.withdrawalsService.findAll();
  }

  @Patch(':id/complete')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Mark withdrawal completed — Admin' })
  @ApiResponse({ status: 200, description: 'Withdrawal completed' })
  completeWithdrawal(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: ProcessWithdrawalDto,
  ) {
    return this.withdrawalsService.completeWithdrawal(id, user.userId, dto);
  }

  @Patch(':id/reject')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Reject withdrawal — Admin' })
  @ApiResponse({ status: 200, description: 'Withdrawal rejected' })
  rejectWithdrawal(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: RejectWithdrawalDto,
  ) {
    return this.withdrawalsService.rejectWithdrawal(id, user.userId, dto);
  }
}
