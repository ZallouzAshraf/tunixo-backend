import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateOrderDto {
  @ApiProperty({ description: 'Product ID' })
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @ApiPropertyOptional({
    description: 'Game player ID (required for TOPUP products)',
  })
  @IsString()
  @IsOptional()
  playerId?: string;

  @ApiPropertyOptional({
    description: 'Server/zone ID (e.g. for Mobile Legends)',
  })
  @IsString()
  @IsOptional()
  zoneId?: string;
}
