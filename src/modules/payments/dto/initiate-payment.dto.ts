import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsString, IsOptional, Min } from 'class-validator';

export class InitiatePaymentDto {
  @ApiProperty({ example: 50, minimum: 5, description: 'Amount in TND' })
  @IsNumber()
  @Min(5, { message: 'Minimum amount is 5 TND' })
  amount!: number;

  @ApiPropertyOptional({ example: 'Wallet top-up' })
  @IsString()
  @IsOptional()
  description?: string;
}
