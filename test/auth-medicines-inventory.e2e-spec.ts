import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/common/prisma/prisma.service';
import { AuthService } from './../src/auth/auth.service';
import { MedicinesService } from './../src/medicines/medicines.service';
import { InventoryService } from './../src/inventory/inventory.service';
import { AuditLogsService } from './../src/audit-logs/audit-logs.service';
import { csrfMiddleware } from './../src/common/middleware/csrf.middleware';
import { XssSanitizationPipe } from './../src/common/pipes/xss-sanitization.pipe';
import { CSRF_TOKEN_COOKIE } from './../src/common/auth-cookies';
import { UserRole } from '@generated/prisma';

describe('Auth, medicines, and inventory API (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let authService: { login: jest.Mock; register: jest.Mock };
  let medicinesService: {
    findAll: jest.Mock;
    create: jest.Mock;
    findOne: jest.Mock;
  };
  let inventoryService: { findByPharmacy: jest.Mock; create: jest.Mock };

  const pharmacyId = '11111111-1111-4111-8111-111111111111';
  const medicineId = '22222222-2222-4222-8222-222222222222';

  const tokenFor = (role: UserRole, userId = 'user-1') =>
    jwtService.sign({
      sub: userId,
      email: `${role.toLowerCase()}@example.com`,
      role,
      permissions: [],
    });

  const csrfHeaders = (csrfToken: string) => ({
    Cookie: `${CSRF_TOKEN_COOKIE}=${encodeURIComponent(csrfToken)}`,
    'X-CSRF-Token': csrfToken,
  });

  const tokenFrom = (response: request.Response) => {
    const cookies = response.headers['set-cookie'] as unknown as string[];
    const cookie = cookies.find((value) => value.startsWith(`${CSRF_TOKEN_COOKIE}=`));
    expect(cookie).toBeDefined();
    return decodeURIComponent(cookie!.split(';', 1)[0].split('=', 2)[1]);
  };

  beforeAll(async () => {
    authService = {
      login: jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'patient@example.com',
        role: UserRole.PATIENT,
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      }),
      register: jest.fn().mockResolvedValue({
        id: 'new-user',
        email: 'new@example.com',
        role: UserRole.PATIENT,
      }),
    };
    medicinesService = {
      findAll: jest.fn().mockResolvedValue({
        items: [{ id: medicineId, tradeName: 'Paracetamol' }],
        total: 1,
        page: 1,
        limit: 10,
      }),
      create: jest.fn().mockResolvedValue({ id: medicineId, tradeName: 'Amoxicillin' }),
      findOne: jest.fn().mockResolvedValue({ id: medicineId, tradeName: 'Paracetamol' }),
    };
    inventoryService = {
      findByPharmacy: jest.fn().mockResolvedValue([{ id: 'inventory-1', quantity: 20 }]),
      create: jest.fn().mockResolvedValue({ id: 'inventory-1', quantity: 20 }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        onModuleInit: jest.fn(),
        onModuleDestroy: jest.fn(),
        prisma: {},
      })
      .overrideProvider(AuthService)
      .useValue(authService)
      .overrideProvider(MedicinesService)
      .useValue(medicinesService)
      .overrideProvider(InventoryService)
      .useValue(inventoryService)
      .overrideProvider(AuditLogsService)
      .useValue({ log: jest.fn().mockResolvedValue(undefined) })
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(csrfMiddleware);
    app.useGlobalPipes(
      new XssSanitizationPipe(),
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    jwtService = app.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('auth endpoints', () => {
    it('issues a host-only CSRF cookie with a token', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/auth/csrf-token');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        requestId: expect.any(String),
      });
      expect(response.body.data.csrfToken).toBeTruthy();
      const cookie = (response.headers['set-cookie'] as unknown as string[]).find((value) =>
        value.startsWith(`${CSRF_TOKEN_COOKIE}=`),
      );
      expect(cookie).toMatch(/; Secure/i);
      expect(cookie).toMatch(/; Path=\//i);
      expect(cookie).not.toMatch(/; Domain=/i);
    });

    it('allows login without a CSRF token and sets authentication cookies', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'patient@example.com', password: 'secret123' });

      expect(response.status).toBe(201);
      expect(authService.login).toHaveBeenCalledWith({
        email: 'patient@example.com',
        password: 'secret123',
      });
      expect(response.headers['set-cookie']).toEqual(
        expect.arrayContaining([
          expect.stringContaining('epharmacy_access=access-token'),
          expect.stringContaining('epharmacy_refresh=refresh-token'),
        ]),
      );
    });

    it('rejects an unsafe non-exempt request without a CSRF token', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({});

      expect(response.status).toBe(403);
      expect(response.body.error).toMatchObject({
        code: 'FORBIDDEN',
        message: 'Invalid CSRF token',
      });
    });
  });

  describe('medicines endpoints', () => {
    it('requires authentication for the medicine list', async () => {
      await request(app.getHttpServer()).get('/api/v1/medicines').expect(401);
    });

    it('lists medicines for an authenticated patient', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/medicines?page=1&limit=10')
        .set('Authorization', `Bearer ${tokenFor(UserRole.PATIENT)}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items[0].tradeName).toBe('Paracetamol');
      expect(medicinesService.findAll).toHaveBeenCalledWith(1, 10, false, undefined, undefined);
    });

    it('validates and creates a medicine with CSRF protection', async () => {
      const csrfResponse = await request(app.getHttpServer()).get('/api/v1/auth/csrf-token');
      const csrfToken = csrfResponse.body.data.csrfToken as string;
      const payload = {
        tradeName: 'Amoxicillin',
        genericName: 'Amoxicillin',
        categoryName: 'Antibiotics',
        manufacturerName: 'Generic Labs',
        initialBatch: {
          lotNumber: 'LOT-1',
          batchNumber: 'BATCH-1',
          expiryDate: '2027-12-31',
          unitCost: 5,
          unitSellingPrice: 8,
          initialStock: 100,
        },
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/medicines')
        .set('Authorization', `Bearer ${tokenFor(UserRole.PHARMACY_OWNER)}`)
        .set(csrfHeaders(csrfToken))
        .send(payload)
        .expect(201);

      expect(response.body.data.id).toBe(medicineId);
      expect(medicinesService.create).toHaveBeenCalledWith(payload);
    });

    it('rejects an invalid medicine payload', async () => {
      const csrfResponse = await request(app.getHttpServer()).get('/api/v1/auth/csrf-token');
      const csrfToken = csrfResponse.body.data.csrfToken as string;

      const response = await request(app.getHttpServer())
        .post('/api/v1/medicines')
        .set('Authorization', `Bearer ${tokenFor(UserRole.ADMIN)}`)
        .set(csrfHeaders(csrfToken))
        .send({ tradeName: 'Incomplete' })
        .expect(400);
      expect(response.body.error).toMatchObject({
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
      });
      expect(medicinesService.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('inventory endpoints', () => {
    it('lists pharmacy inventory for a patient', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/pharmacies/${pharmacyId}/inventory`)
        .set('Authorization', `Bearer ${tokenFor(UserRole.PATIENT)}`)
        .expect(200);

      expect(response.body.data).toEqual([{ id: 'inventory-1', quantity: 20 }]);
      expect(inventoryService.findByPharmacy).toHaveBeenCalledWith(
        pharmacyId,
        expect.objectContaining({ role: UserRole.PATIENT }),
      );
    });

    it('forbids a patient from adding inventory', async () => {
      const csrfResponse = await request(app.getHttpServer()).get('/api/v1/auth/csrf-token');
      const csrfToken = csrfResponse.body.data.csrfToken as string;

      await request(app.getHttpServer())
        .post(`/api/v1/pharmacies/${pharmacyId}/inventory`)
        .set('Authorization', `Bearer ${tokenFor(UserRole.PATIENT)}`)
        .set(csrfHeaders(csrfToken))
        .send({ medicineId, quantity: 10, price: 4.5 })
        .expect(403);
      expect(inventoryService.create).not.toHaveBeenCalled();
    });

    it('adds inventory for a pharmacy owner with CSRF protection', async () => {
      const csrfResponse = await request(app.getHttpServer()).get('/api/v1/auth/csrf-token');
      const csrfToken = csrfResponse.body.data.csrfToken as string;
      const payload = { medicineId, quantity: 10, price: 4.5 };

      const response = await request(app.getHttpServer())
        .post(`/api/v1/pharmacies/${pharmacyId}/inventory`)
        .set('Authorization', `Bearer ${tokenFor(UserRole.PHARMACY_OWNER)}`)
        .set(csrfHeaders(csrfToken))
        .send(payload)
        .expect(201);

      expect(response.body.data.id).toBe('inventory-1');
      expect(inventoryService.create).toHaveBeenCalledWith(
        pharmacyId,
        expect.objectContaining({ role: UserRole.PHARMACY_OWNER }),
        payload,
      );
    });
  });
});
