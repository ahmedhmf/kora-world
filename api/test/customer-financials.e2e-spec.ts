import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { CustomerFinancialsController } from '../src/delivery-notes/customer-financials.controller';
import { CustomerFinancialsService } from '../src/delivery-notes/customer-financials.service';
import { CustomerStatementsService } from '../src/delivery-notes/customer-statements.service';
import { AuthGuard } from '../src/auth/auth.guard';
import { RolesGuard } from '../src/auth/roles.guard';

// HTTP-level contract tests with isolated financial services.
// Database-backed E2E tests are a separate required stage before production.
describe('Customer Financials HTTP contracts (e2e)', () => {
  let app: INestApplication;
  const financials = {
    overview: jest.fn().mockResolvedValue({ currency: 'EUR', outstanding: '750.00',
      unallocatedCredit: '100.00', netExposure: '650.00' }),
    allocate: jest.fn().mockResolvedValue({ id: 31, amountCents: '10000' }),
    recordPayment: jest.fn().mockResolvedValue({ id: 11, amountCents: '20000' }),
    pricing: jest.fn().mockResolvedValue([]),
  };
  const statements = {
    preview: jest.fn().mockResolvedValue({ currency: 'EUR', openingBalance: '850.00',
      closingBalance: '750.00', unallocatedCredit: '100.00' }),
    history: jest.fn().mockResolvedValue([]),
    getSaved: jest.fn().mockResolvedValue({ id: 3 }),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [CustomerFinancialsController],
      providers: [
        { provide: CustomerFinancialsService, useValue: financials },
        { provide: CustomerStatementsService, useValue: statements },
      ],
    }).overrideGuard(AuthGuard).useValue({
      canActivate: (context: any) => {
        context.switchToHttp().getRequest().user = { sub: 7, role: 'admin' };
        return true;
      },
    }).overrideGuard(RolesGuard).useValue({ canActivate: () => true }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => { await app?.close(); });

  it('GET overview exposes available credit and net exposure', async () => {
    const response = await request(app.getHttpServer())
      .get('/customer-financials/account/1/overview').expect(200);
    expect(response.body).toMatchObject({ unallocatedCredit: '100.00', netExposure: '650.00' });
    expect(financials.overview).toHaveBeenCalledWith(1);
  });

  it('GET statement preview forwards the reporting period', async () => {
    await request(app.getHttpServer())
      .get('/customer-financials/account/1/statements/preview')
      .query({ from: '2026-10-01', to: '2026-10-31', currency: 'EUR' }).expect(200);
    expect(statements.preview).toHaveBeenCalledWith(1, '2026-10-01', '2026-10-31', 'EUR');
  });

  it('POST allocations forwards the authenticated user', async () => {
    await request(app.getHttpServer()).post('/customer-financials/account/1/allocations')
      .send({ paymentId: 11, settlementId: 21, amount: '100.00' }).expect(201);
    expect(financials.allocate).toHaveBeenCalledWith(1,
      { paymentId: 11, settlementId: 21, amount: '100.00' },
      expect.objectContaining({ sub: 7 }));
  });

  it('POST payments forwards the authenticated user', async () => {
    await request(app.getHttpServer()).post('/customer-financials/account/1/payments')
      .send({ amount: '200.00', paymentDate: '2026-11-08',
        reference: 'BANK-1', method: 'bank_transfer' }).expect(201);
    expect(financials.recordPayment).toHaveBeenCalledWith(1,
      expect.objectContaining({ amount: '200.00' }), expect.objectContaining({ sub: 7 }));
  });
});
