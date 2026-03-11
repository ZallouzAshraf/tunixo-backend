import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
} from "class-validator";

export class CreateServiceDto {
  @ApiProperty({ example: "Cursor Pro" })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: "AI code editor" })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 75 })
  @IsNumber()
  @Min(0)
  priceTnd!: number;

  @ApiProperty({ example: 20 })
  @IsNumber()
  @Min(0)
  priceUsd!: number;

  @ApiPropertyOptional({ example: "AI Tools" })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiPropertyOptional({ example: "https://cursor.sh/logo.svg" })
  @IsString()
  @IsOptional()
  imageUrl?: string;
}
