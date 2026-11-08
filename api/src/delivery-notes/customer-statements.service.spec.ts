import { CustomerStatementsService } from './customer-statements.service';
import { Account } from '../accounts/entities/account.entity';
import { SalesSettlement } from './sales-settlement.entity';
import { CustomerPayment } from './customer-payment.entity';
import { WeeklySalesReport } from './weekly-sales-report.entity';
import { PaymentAllocation } from './payment-allocation.entity';

describe('CustomerStatementsService', () => {
  const account = { id: 1, companyName: 'Test Shop', accountNumber: 'C-1',
    defaultCurrency: 'EUR', settlementDueDay: 15 };
  const settlements = [{ id: 21, accountId: 1, reportId: 8, totalCents: '85000',
    currency: 'EUR', createdAt: new Date('2026-10-10T12:00:00Z'), reversedAt: null }];
  const payments = [{ id: 11, accountId: 1, amountCents: '20000',
    currency: 'EUR', paymentDate: '2026-10-15', reference: 'BANK-1' }];
  const allocations = [{ id: 31, paymentId: 11, settlementId: 21,
    amountCents: '10000', createdAt: new Date('2026-10-20T12:00:00Z') }];
  let service: CustomerStatementsService;

  beforeEach(() => {
    const db: any = {
      getRepository: jest.fn((entity: any) => ({
        findOneBy: jest.fn(async () => entity === Account ? account : null),
        find: jest.fn(async () => entity === SalesSettlement ? settlements :
          entity === CustomerPayment ? payments : []),
        createQueryBuilder: jest.fn(() => ({
          where: jest.fn().mockReturnThis(),
          getMany: jest.fn(async () => entity === PaymentAllocation ? allocations :
            entity === WeeklySalesReport ? [{ id: 8, weekEnd: '2026-10-10' }] : []),
        })),
      })),
    };
    service = new CustomerStatementsService(db);
  });

  it('carries opening balance into period running balances', async () => {
    const result = await service.preview(1, '2026-10-15', '2026-10-31');
    expect(result.openingBalance).toBe('850.00');
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].runningBalance).toBe('750.00');
    expect(result.closingBalance).toBe('750.00');
  });

  it('reports unapplied customer credit separately from statement balance', async () => {
    const result = await service.preview(1, '2026-10-01', '2026-10-31');
    expect(result.unallocatedCredit).toBe('100.00');
    expect(result.closingBalance).toBe('750.00');
    expect(result.netExposure).toBe('650.00');
  });

  it('does not include allocations made after the statement period', async () => {
    const result = await service.preview(1, '2026-10-01', '2026-10-15');
    expect(result.closingBalance).toBe('850.00');
    expect(result.unallocatedCredit).toBe('200.00');
  });

  it('rejects reversed date ranges', async () => {
    await expect(service.preview(1, '2026-11-01', '2026-10-01')).rejects.toThrow('Invalid statement date range');
  });

  it('keeps saved-statement computation read-only during preview', async () => {
    const result = await service.preview(1, '2026-10-01', '2026-10-31');
    expect(result.currency).toBe('EUR');
    expect(result.customer.companyName).toBe('Test Shop');
  });
});
