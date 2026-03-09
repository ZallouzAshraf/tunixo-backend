import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsString, IsOptional, IsNotEmpty, Min } from 'class-validator';

export class CreateDepositDto {
  @ApiProperty({ example: 50 })
  @IsNumber()
  @Min(5)
  amountUsd!: number;

  @ApiProperty({ example: 'paypal' })
  @IsString()
  @IsNotEmpty()
  paymentMethod!: string;

  @ApiPropertyOptional({
    example: 'https://proof-screenshot-url.com',
  })
  @IsString()
  @IsOptional()
  proofUrl?: string;

  @ApiPropertyOptional({ example: 'TXN123456' })
  @IsString()
  @IsOptional()
  paymentReference?: string;
}

export class ConfirmDepositDto {
  @ApiPropertyOptional({ example: 3.0 })
  @IsNumber()
  @IsOptional()
  exchangeRate?: number;
}

export class RejectDepositDto {
  @ApiProperty({ example: 'Invalid proof of payment' })
  @IsString()
  @IsNotEmpty()
  rejectionReason!: string;
}
