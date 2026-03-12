import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsString, IsOptional, Min, Max, IsNotEmpty } from 'class-validator';
import { Role } from '@prisma/client';

export class UpdateUserRoleDto {
  @ApiProperty({ enum: ['BUYER', 'ADMIN'] })
  @IsEnum(Role)
  role!: Role;
}

export class UpdateExchangeRateDto {
  @ApiProperty({ example: 3.15 })
  @IsNumber()
  @Min(1)
  officialRate!: number;

  @ApiProperty({ example: 3.0 })
  @IsNumber()
  @Min(1)
  platformRate!: number;
}

export class TopupPlatformReserveDto {
  @ApiProperty({ example: 500 })
  @IsNumber()
  @Min(1)
  amountUsd!: number;

  @ApiProperty({ example: 'Manual topup — card ending 4242' })
  @IsString()
  @IsNotEmpty()
  description!: string;
}

export class PaginationDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
