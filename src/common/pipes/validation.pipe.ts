import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  ValidationPipe as NestValidationPipe,
} from '@nestjs/common';

@Injectable()
export class ValidationPipe
  extends NestValidationPipe
  implements PipeTransform<any>
{
  constructor() {
    super({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    });
  }
}
