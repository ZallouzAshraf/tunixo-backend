import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsArray, ArrayMinSize } from 'class-validator';

export class BulkCreateGiftCodesDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @ApiProperty({ type: [String], example: ['CODE1', 'CODE2'] })
  @IsArray()
  @ArrayMinSize(1)
  codes!: string[];
}
