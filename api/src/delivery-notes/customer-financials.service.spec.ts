import { BadRequestException } from '@nestjs/common';
import { CustomerFinancialsService } from './customer-financials.service';
import { Account } from '../accounts/entities/account.entity';
import { CustomerPayment } from './customer-payment.entity';
import { PaymentAllocation } from './payment-allocation.entity';
import { SalesSettlement } from './sales-settlement.entity';

describe('CustomerFinancialsService', () => {
  const account = { id: 1, defaultCurrency: 'EUR' };
  const payment = { id: 11, accountId: 1, amountCents: '20000', currency: 'EUR' };
  const settlement = { id: 21, accountId: 1, totalCents: '85000', currency: 'EUR', status: 'active' };
  const allocations = [{ id: 31, paymentId: 11, settlementId: 21, amountCents: '10000' }];
  let manager: any;
  let service: CustomerFinancialsService;

  beforeEach(() => {
    manager = {
      findOne: jest.fn(async (entity: any) =>
        entity === Account ? account : entity === CustomerPayment ? payment :
        entity === SalesSettlement ? settlement : null),
      find: jest.fn(async (entity: any) => entity === PaymentAllocation ? allocations : []),
      exists: jest.fn(async () => false),
      save: jest.fn(async (_entity: any, value: any) => value),
      create: jest.fn((_entity: any, value: any) => value),
    };
    const db: any = {
      manager,
      transaction: jest.fn(async (fn: any) => fn(manager)),
      getRepository: jest.fn((entity: any) => ({
        find: jest.fn(async () => entity === SalesSettlement ? [settlement] :
          entity === CustomerPayment ? [payment] : []),
        createQueryBuilder: jest.fn(() => ({
          where: jest.fn().mockReturnThis(),
          getMany: jest.fn(async () => allocations),
        })),
      })),
    };
    service = new CustomerFinancialsService(db);
  });

  it('shows partially allocated advances without netting them against receivables', async () => {
    const result = await service.overview(1);
    expect(result.outstanding).toBe('750.00');
    expect(result.unallocatedCredit).toBe('100.00');
    expect(result.netExposure).toBe('650.00');
    expect(result.payments[0].unallocated).toBe('100.00');
  });

  it('rejects allocation exceeding the remaining payment', async () => {
    await expect(service.allocate(1, { paymentId: 11, settlementId: 21, amount: '100.01' }, { sub: 1 } as any))
      .rejects.toThrow(BadRequestException);
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('rejects allocation exceeding the settlement outstanding', async () => {
    manager.findOne.mockImplementation(async (entity: any) =>
      entity === Account ? account : entity === CustomerPayment ? payment :
      entity === SalesSettlement ? { ...settlement, totalCents: '15000' } : null);
    await expect(service.allocate(1, { paymentId: 11, settlementId: 21, amount: '60.00' }, { sub: 1 } as any))
      .rejects.toThrow(BadRequestException);
  });

  it('rejects allocations to reversed settlements', async () => {
    manager.findOne.mockImplementation(async (entity: any) =>
      entity === Account ? account : entity === CustomerPayment ? payment :
      entity === SalesSettlement ? { ...settlement, status: 'reversed' } : null);
    await expect(service.allocate(1, { paymentId: 11, settlementId: 21, amount: '10.00' }, { sub: 1 } as any))
      .rejects.toThrow(BadRequestException);
  });

  it('rejects duplicate payment-to-settlement allocations', async () => {
    manager.exists.mockResolvedValue(true);
    await expect(service.allocate(1, { paymentId: 11, settlementId: 21, amount: '10.00' }, { sub: 1 } as any))
      .rejects.toThrow('Payment already allocated');
  });

  it('rejects amounts with more than two decimal places', async () => {
    await expect(service.recordPayment(1, {
      amount: '1.001', paymentDate: '2026-11-08', reference: 'BANK-1', method: 'bank_transfer',
    }, { sub: 1 } as any)).rejects.toThrow(BadRequestException);
  });

  it('prevents reversing settlements that have allocated payments', async () => {
    manager.findOne.mockResolvedValue(settlement);
    manager.exists.mockResolvedValue(true);
    await expect(service.reverseSettlement(manager, 9)).rejects.toThrow('allocated payments');
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('records a valid advance payment with its currency and audit user', async () => {
    const saved = await service.recordPayment(1, {
      amount: '200.00', paymentDate: '2026-11-08', reference: 'BANK-1', method: 'bank_transfer',
    }, { sub: 7 } as any);
    expect(saved).toMatchObject({ amountCents: '20000', currency: 'EUR', accountId: 1, createdById: 7 });
  });
});
