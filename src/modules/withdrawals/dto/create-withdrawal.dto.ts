import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsString, IsNotEmpty, IsObject, IsOptional, Min } from 'class-validator';

export class CreateWithdrawalDto {
  @ApiProperty({ example: 100 })
  @IsNumber()
  @Min(20)
  amountTnd!: number;

  @ApiProperty({ example: 'd17' })
  @IsString()
  @IsNotEmpty()
  method!: string;

  @ApiProperty({
    example: { phone: '+21612345678' },
  })
  @IsObject()
  @IsNotEmpty()
  methodDetails!: Record<string, any>;
}

export class ProcessWithdrawalDto {
  @ApiPropertyOptional({
    example: 'Transfer sent via D17',
  })
  @IsString()
  @IsOptional()
  note?: string;
}

export class RejectWithdrawalDto {
  @ApiProperty({ example: 'Incorrect account details' })
  @IsString()
  @IsNotEmpty()
  rejectionReason!: string;
}
