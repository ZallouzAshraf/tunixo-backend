import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

describe('Orders (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;
  let userId: string;
  let serviceId: string;

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

    const email = `orders-${Date.now()}@tunixo.test`;
    const hashedPassword = await bcrypt.hash('password123', 10);
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        fullName: 'Orders Test User',
        role: Role.USER,
        walletBalance: 100,
      },
    });
    userId = user.id;

    const service = await prisma.service.create({
      data: {
        name: 'E2E Test Service',
        slug: `e2e-test-${Date.now()}`,
        priceTnd: 20,
        priceUsd: 6,
        isActive: true,
      },
    });
    serviceId = service.id;

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'password123' });
    accessToken = loginRes.body.data?.accessToken ?? loginRes.body?.accessToken;
  });

  afterAll(async () => {
    await prisma.order.deleteMany({ where: { userId } });
    await prisma.transaction.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.service.deleteMany({ where: { id: serviceId } });
    await app.close();
  });

  it('GET /orders - should return user orders', () => {
    return request(app.getHttpServer())
      .get('/orders')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body.data)).toBe(true);
      });
  });

  it('POST /orders - should create order when balance sufficient', () => {
    return request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ serviceId })
      .expect(201)
      .expect((res) => {
        expect(res.body.data).toBeDefined();
        expect(res.body.data.serviceId).toBe(serviceId);
        expect(['PENDING', 'ACTIVE']).toContain(res.body.data.status);
      });
  });

  it('POST /orders - should reject when serviceId missing', () => {
    return request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({})
      .expect(400);
  });
});
