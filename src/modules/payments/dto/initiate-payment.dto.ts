import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsString, IsOptional, Min } from 'class-validator';

export class InitiatePaymentDto {
  @ApiProperty({ example: 75 })
  @IsNumber()
  @Min(1)
  amount!: number;

  @ApiPropertyOptional({ example: 'Wallet top-up' })
  @IsString()
  @IsOptional()
  description?: string;
}
