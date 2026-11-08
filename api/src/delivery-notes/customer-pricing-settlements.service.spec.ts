import { BadRequestException } from '@nestjs/common';
import { CustomerFinancialsService } from './customer-financials.service';
import { Account } from '../accounts/entities/account.entity';
import { Product } from '../products/entities/product.entity';
import { CustomerPricingRule } from './customer-pricing-rule.entity';
import { WeeklySalesReport } from './weekly-sales-report.entity';
import { SalesSettlement } from './sales-settlement.entity';
import { PaymentAllocation } from './payment-allocation.entity';

describe('Customer financial pricing and settlement calculations', () => {
  const account = { id: 1, defaultCurrency: 'EUR' };
  const report = { id: 10, accountId: 1, weekEnd: '2026-10-31', status: 'draft',
    retailPrices: { '5': '100.00' },
    items: [{ productId: 5, articleNumber: 'ART-5', quantity: 3 }] };
  let rules: any[];
  let manager: any;
  let service: CustomerFinancialsService;

  beforeEach(() => {
    rules = [{ id: 7, accountId: 1, productId: 5, kind: 'fixed',
      currency: 'EUR', unitPrice: '12.50', effectiveFrom: '2026-01-01', effectiveTo: null }];
    manager = {
      findOne: jest.fn(async (entity: any) =>
        entity === Account ? account : entity === WeeklySalesReport ? report : null),
      find: jest.fn(async (entity: any) => entity === CustomerPricingRule ? rules : []),
      exists: jest.fn(async (entity: any) => entity === Product),
      save: jest.fn(async (_entity: any, value: any) => value),
      create: jest.fn((_entity: any, value: any) => value),
    };
    const db: any = {
      manager,
      transaction: jest.fn(async (callback: any) => callback(manager)),
      getRepository: jest.fn(),
    };
    service = new CustomerFinancialsService(db);
  });

  it('calculates fixed-price settlements in integer cents', async () => {
    const result = await service.preview(10);
    expect(result.totalCents).toBe('3750');
    expect(result.lines[0]).toMatchObject({
      unitSettlementCents: 1250, totalCents: 3750, quantity: 3,
    });
  });

  it('calculates actual retail commission with correct rounding', async () => {
    rules[0] = { ...rules[0], kind: 'commission_actual', commissionPercent: '12.50' };
    report.retailPrices['5'] = '19.99';
    const result = await service.preview(10);
    expect(result.lines[0].unitSettlementCents).toBe(1749);
    expect(result.totalCents).toBe('5247');
  });

  it('calculates commission from an agreed retail price', async () => {
    rules[0] = { ...rules[0], kind: 'commission_agreed',
      commissionPercent: '20.00', agreedRetailPrice: '50.00' };
    const result = await service.preview(10);
    expect(result.totalCents).toBe('12000');
  });

  it('rejects missing pricing agreements', async () => {
    rules = [];
    await expect(service.preview(10)).rejects.toThrow('Exactly one active pricing rule');
  });

  it('rejects ambiguous overlapping pricing agreements during settlement', async () => {
    rules.push({ ...rules[0], id: 8 });
    await expect(service.preview(10)).rejects.toThrow('Exactly one active pricing rule');
  });

  it('rejects pricing currency mismatches', async () => {
    rules[0].currency = 'USD';
    await expect(service.preview(10)).rejects.toThrow('Pricing currency mismatch');
  });

  it('rejects overlapping new agreements', async () => {
    await expect(service.addPricing(1, {
      productId: 5, kind: 'fixed', unitPrice: '10.00', effectiveFrom: '2026-10-01',
    }, { sub: 7 } as any)).rejects.toThrow('Pricing date range overlaps');
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('rejects commission percentages above 100', async () => {
    await expect(service.addPricing(1, {
      productId: 5, kind: 'commission_actual', commissionPercent: '100.01',
      effectiveFrom: '2027-01-01',
    }, { sub: 7 } as any)).rejects.toThrow(BadRequestException);
  });

  it('creates a settlement from a priced report', async () => {
    const saved = await service.createSettlement(manager, report as any);
    expect(saved).toMatchObject({ reportId: 10, accountId: 1,
      totalCents: '3750', currency: 'EUR', status: 'active' });
  });

  it('rejects a second settlement for the same report', async () => {
    manager.findOne.mockImplementation(async (entity: any) =>
      entity === Account ? account : entity === SalesSettlement ? { id: 99 } : null);
    await expect(service.createSettlement(manager, report as any))
      .rejects.toThrow('Settlement already exists');
  });

  it('reverses an unallocated settlement', async () => {
    const existing = { id: 50, status: 'active', reversedAt: null };
    manager.findOne.mockResolvedValue(existing);
    manager.exists.mockResolvedValue(false);
    const result = await service.reverseSettlement(manager, 10);
    expect(result).toBeUndefined();
    expect(existing.status).toBe('reversed');
    expect(existing.reversedAt).toBeInstanceOf(Date);
    expect(manager.save).toHaveBeenCalledWith(SalesSettlement, existing);
  });

  it('blocks cancellation when a payment allocation exists', async () => {
    manager.findOne.mockResolvedValue({ id: 50, status: 'active' });
    manager.exists.mockImplementation(async (entity: any) => entity === PaymentAllocation);
    await expect(service.reverseSettlement(manager, 10)).rejects.toThrow('allocated payments');
  });
});
