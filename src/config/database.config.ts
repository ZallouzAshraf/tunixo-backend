import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  url: process.env.DATABASE_URL || 'postgresql://tunixo:tunixo_password@localhost:5432/tunixo_db',
}));
