import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SmileOneService, ValidatePlayerResult } from './smile-one.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

class ValidatePlayerDto {
  gameId!: string;
  playerId!: string;
  zoneId?: string;
}

@ApiTags('Topup')
@Controller('topup')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class TopupController {
  constructor(private smileOne: SmileOneService) {}

  @Post('validate-player')
  @ApiOperation({ summary: 'Validate game player ID before order' })
  async validatePlayer(
    @Body() dto: ValidatePlayerDto,
  ): Promise<ValidatePlayerResult> {
    return this.smileOne.validatePlayer(
      dto.gameId,
      dto.playerId,
      dto.zoneId,
    );
  }
}
