import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { GiftCodesService } from './giftcodes.service';
import { BulkCreateGiftCodesDto } from './dto/bulk-create.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { CodeStatus } from '@prisma/client';

@ApiTags('Admin - Gift Codes')
@ApiBearerAuth('access-token')
@Controller('admin/giftcodes')
@UseGuards(JwtAuthGuard, AdminGuard)
@Roles(Role.ADMIN)
export class GiftCodesController {
  constructor(private readonly giftcodesService: GiftCodesService) {}

  @Post('bulk')
  @ApiOperation({ summary: 'Add gift codes in bulk' })
  bulkCreate(@Body() dto: BulkCreateGiftCodesDto) {
    return this.giftcodesService.bulkCreate(dto.productId, dto.codes);
  }

  @Get()
  @ApiOperation({ summary: 'List all gift codes with status' })
  @ApiQuery({ name: 'productId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: CodeStatus })
  findAll(
    @Query('productId') productId?: string,
    @Query('status') status?: CodeStatus,
  ) {
    return this.giftcodesService.findAll({ productId, status });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Available count per product' })
  getStats() {
    return this.giftcodesService.getStats();
  }
}
