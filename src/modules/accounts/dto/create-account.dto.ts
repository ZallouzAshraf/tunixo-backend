import { IsString, IsNotEmpty, IsObject } from 'class-validator';

export class CreateAccountDto {
  @IsString()
  @IsNotEmpty()
  serviceId!: string;

  @IsObject()
  credentials!: Record<string, unknown>;
}
