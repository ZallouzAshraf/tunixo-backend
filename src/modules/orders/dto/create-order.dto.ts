import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEmail } from 'class-validator';

export class CreateOrderDto {
  @ApiProperty({ example: 'clsid-here' })
  @IsString()
  @IsNotEmpty()
  serviceId!: string;

  @ApiProperty({
    example: 'mycursor@gmail.com',
    description: "Your account email on the service platform",
  })
  @IsEmail()
  @IsNotEmpty()
  serviceEmail!: string;
}
