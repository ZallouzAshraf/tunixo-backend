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
} from '@nestjs/swagger';
import { DepositsService } from './deposits.service';
import { CreateDepositDto, ConfirmDepositDto, RejectDepositDto } from './dto/create-deposit.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';
import { DepositStatus } from '@prisma/client';

@ApiTags('Deposits')
@Controller('deposits')
export class DepositsController {
  constructor(private readonly depositsService: DepositsService) {}

  @Post()
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Submit a new USD deposit' })
  @ApiResponse({ status: 201, description: 'Deposit submitted' })
  @ApiResponse({ status: 403, description: 'Not a seller account' })
  create(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateDepositDto) {
    return this.depositsService.create(user.userId, dto);
  }

  @Get('my')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get my deposit history' })
  @ApiResponse({ status: 200, description: 'Deposit list' })
  findMyDeposits(@CurrentUser() user: CurrentUserPayload) {
    return this.depositsService.findMyDeposits(user.userId);
  }

  @Get('pending')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get all pending deposits — Admin' })
  @ApiResponse({ status: 200, description: 'Pending deposits' })
  findAllPending() {
    return this.depositsService.findAllPending();
  }

  @Get('stats')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get deposit statistics — Admin' })
  @ApiResponse({ status: 200, description: 'Deposit stats' })
  getDepositStats() {
    return this.depositsService.getDepositStats();
  }

  @Get()
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get all deposits with filters — Admin' })
  @ApiResponse({ status: 200, description: 'Deposit list' })
  findAll(
    @Query('status') status?: DepositStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.depositsService.findAll({
      status: status as DepositStatus | undefined,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get(':id')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get deposit by ID' })
  @ApiResponse({ status: 200, description: 'Deposit details' })
  @ApiResponse({ status: 404, description: 'Deposit not found' })
  findById(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.depositsService.findById(id, user.userId, user.role);
  }

  @Patch(':id/confirm')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Confirm deposit — Admin' })
  @ApiResponse({ status: 200, description: 'Deposit confirmed' })
  @ApiResponse({ status: 400, description: 'Deposit already processed' })
  confirmDeposit(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: ConfirmDepositDto,
  ) {
    return this.depositsService.confirmDeposit(id, user.userId, dto);
  }

  @Patch(':id/reject')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Reject deposit — Admin' })
  @ApiResponse({ status: 200, description: 'Deposit rejected' })
  @ApiResponse({ status: 400, description: 'Deposit already processed' })
  rejectDeposit(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: RejectDepositDto,
  ) {
    return this.depositsService.rejectDeposit(id, user.userId, dto);
  }
}
