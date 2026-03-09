import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsObject, IsArray } from 'class-validator';

export class CreateAccountDto {
  @ApiProperty({ example: 'service-id-here' })
  @IsString()
  @IsNotEmpty()
  serviceId!: string;

  @ApiProperty({
    example: { email: 'account@example.com', password: 'pass123' },
  })
  @IsObject()
  @IsNotEmpty()
  credentials!: Record<string, any>;
}

export class BulkCreateAccountDto {
  @ApiProperty({ example: 'service-id-here' })
  @IsString()
  @IsNotEmpty()
  serviceId!: string;

  @ApiProperty({
    example: [
      { email: 'acc1@example.com', password: 'pass1' },
      { email: 'acc2@example.com', password: 'pass2' },
    ],
  })
  @IsArray()
  @IsNotEmpty()
  credentials!: Record<string, any>[];
}
