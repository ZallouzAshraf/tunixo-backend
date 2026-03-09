import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);

    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new ResponseInterceptor());

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /auth/register - should register a new user', () => {
    const email = `test-${Date.now()}@tunixo.test`;
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email,
        password: 'password123',
        fullName: 'Test User',
      })
      .expect(201)
      .expect((res) => {
        expect(res.body.data).toBeDefined();
        expect(res.body.data.accessToken).toBeDefined();
        expect(res.body.data.refreshToken).toBeDefined();
        expect(res.body.data.user.email).toBe(email);
      });
  });

  it('POST /auth/register - should reject duplicate email', async () => {
    const email = `dup-${Date.now()}@tunixo.test`;
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: 'password123' })
      .expect(201);
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: 'other456' })
      .expect(409);
  });

  it('POST /auth/login - should login with valid credentials', async () => {
    const email = `login-${Date.now()}@tunixo.test`;
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: 'password123' })
      .expect(201);
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'password123' })
      .expect(201)
      .expect((res) => {
        expect(res.body.data.accessToken).toBeDefined();
        expect(res.body.data.user.email).toBe(email);
      });
  });

  it('POST /auth/login - should reject invalid password', async () => {
    const email = `badpass-${Date.now()}@tunixo.test`;
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: 'password123' })
      .expect(201);
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'wrongpassword' })
      .expect(401);
  });
});
