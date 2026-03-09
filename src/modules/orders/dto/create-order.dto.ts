import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsObject, IsOptional, IsDateString } from 'class-validator';

export class CreateOrderDto {
  @ApiProperty({ example: 'service-id-here' })
  @IsString()
  @IsNotEmpty()
  serviceId!: string;
}

export class FulfillOrderDto {
  @ApiProperty({
    example: {
      email: 'cursor@tunixo.tn',
      password: 'pass123',
    },
  })
  @IsObject()
  @IsNotEmpty()
  credentials!: Record<string, any>;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  expiresAt?: string;
}
