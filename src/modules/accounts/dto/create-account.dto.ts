import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsObject, IsArray, IsOptional } from 'class-validator';

export class CreateAccountDto {
  @ApiProperty({ example: 'service-id-here' })
  @IsString()
  @IsNotEmpty()
  serviceId!: string;

  @ApiPropertyOptional({ example: 'account@tunixo.tn' })
  @IsString()
  @IsOptional()
  accountEmail?: string;

  @ApiProperty({
    example: { email: 'account@example.com', password: 'pass123' },
  })
  @IsObject()
  @IsNotEmpty()
  credentials!: Record<string, unknown>;
}

export class BulkCreateAccountDto {
  @ApiProperty({ example: 'service-id-here' })
  @IsString()
  @IsNotEmpty()
  serviceId!: string;

  @ApiPropertyOptional({
    example: [
      { email: 'acc1@example.com', password: 'pass1' },
      { email: 'acc2@example.com', password: 'pass2' },
    ],
  })
  @IsArray()
  @IsOptional()
  credentials?: Record<string, unknown>[];

  @ApiPropertyOptional({ description: 'Array of credential objects (alias for credentials)' })
  @IsArray()
  @IsOptional()
  accounts?: Record<string, unknown>[];
}
