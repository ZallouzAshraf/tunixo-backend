import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEmail, IsOptional } from 'class-validator';

export class CreateOrderDto {
  @ApiProperty({ example: 'clsid-here' })
  @IsString()
  @IsNotEmpty()
  serviceId!: string;

  @ApiPropertyOptional({
    example: 'mycursor@gmail.com',
    description: "Your account email on the service platform",
  })
  @IsEmail()
  @IsOptional()
  serviceEmail?: string;
}
