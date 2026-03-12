import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsEnum,
  Min,
  IsUrl,
} from 'class-validator';
import { ServiceType } from '@prisma/client';

export class CreateProductDto {
  @ApiProperty({ example: 'Free Fire 100 Diamonds' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'free-fire-100-diamonds' })
  @IsString()
  @IsNotEmpty()
  slug!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsUrl()
  @IsOptional()
  imageUrl?: string;

  @ApiProperty({ example: 'free-fire', description: 'free-fire | pubg | google-play | playstation' })
  @IsString()
  @IsNotEmpty()
  category!: string;

  @ApiProperty({ enum: ['TOPUP', 'GIFTCARD'] })
  @IsEnum(ServiceType)
  serviceType!: ServiceType;

  @ApiPropertyOptional({ example: 'freefire' })
  @IsString()
  @IsOptional()
  gameId?: string;

  @ApiPropertyOptional({ example: '100' })
  @IsString()
  @IsOptional()
  productId?: string;

  @ApiProperty({ example: 5 })
  @IsNumber()
  @Min(0)
  priceTnd!: number;

  @ApiProperty({ example: 0.99 })
  @IsNumber()
  @Min(0)
  costUsd!: number;

  @ApiPropertyOptional({ example: 0 })
  @IsNumber()
  @IsOptional()
  @Min(0)
  sortOrder?: number;
}
