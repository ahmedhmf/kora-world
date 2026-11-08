import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { Account } from '../accounts/entities/account.entity';
import { Product } from '../products/entities/product.entity';
import { ActiveUser } from '../auth/interfaces/authenticated-request.interface';
import { WeeklySalesReport } from './weekly-sales-report.entity';
import { CustomerPricingRule, PricingKind } from './customer-pricing-rule.entity';
import { SalesSettlement } from './sales-settlement.entity';
import { CustomerPayment } from './customer-payment.entity';
import { PaymentAllocation } from './payment-allocation.entity';

const dateOk = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;
const cents = (value: unknown): number => {
  if (typeof value !== 'string' && typeof value !== 'number') throw new BadRequestException('Invalid amount');
  const s = String(value);
  if (!/^(0|[1-9]\d{0,10})(\.\d{1,2})?$/.test(s)) throw new BadRequestException('Amounts require up to two decimals');
  const [whole, frac = ''] = s.split('.');
  const n = Number(whole) * 100 + Number(frac.padEnd(2, '0'));
  if (!Number.isSafeInteger(n)) throw new BadRequestException('Amount too large');
  return n;
};
const percentBps = (value: unknown): number => {
  const n = cents(value);
  if (n > 10000) throw new BadRequestException('Commission must be between 0 and 100%');
  return n;
};
const amount = (n: number) => (n / 100).toFixed(2);

@Injectable()
export class CustomerFinancialsService {
  constructor(private readonly db: DataSource) {}

  private async account(manager: EntityManager, accountId: number, lock = false): Promise<Account> {
    const a = await manager.findOne(Account, { where: { id: accountId }, ...(lock ? { lock: { mode: 'pessimistic_write' as const } } : {}) });
    if (!a) throw new NotFoundException('Account not found');
    if (!/^[A-Z]{3}$/.test(a.defaultCurrency || '')) throw new BadRequestException('Account requires a valid ISO currency');
    return a;
  }

  async pricing(accountId: number) {
    await this.account(this.db.manager, accountId);
    return this.db.getRepository(CustomerPricingRule).find({ where: { accountId }, order: { effectiveFrom: 'DESC', id: 'DESC' } });
  }

  async addPricing(accountId: number, dto: {
    productId: number; kind: PricingKind; unitPrice?: string; commissionPercent?: string;
    agreedRetailPrice?: string; effectiveFrom: string; effectiveTo?: string;
  }, user: ActiveUser) {
    return this.db.transaction(async m => {
      const account = await this.account(m, accountId, true);
      if (!Number.isInteger(dto.productId) || !await m.exists(Product, { where: { id: dto.productId } })) throw new BadRequestException('Invalid product');
      if (!['fixed', 'customer_fixed', 'commission_actual', 'commission_agreed'].includes(dto.kind)) throw new BadRequestException('Invalid pricing type');
      if (!dateOk(dto.effectiveFrom) || (dto.effectiveTo && (!dateOk(dto.effectiveTo) || dto.effectiveTo < dto.effectiveFrom))) throw new BadRequestException('Invalid effective dates');
      const fixed = dto.kind === 'fixed' || dto.kind === 'customer_fixed';
      const unit = fixed ? cents(dto.unitPrice) : null;
      const commission = fixed ? null : percentBps(dto.commissionPercent);
      const retail = dto.kind === 'commission_agreed' ? cents(dto.agreedRetailPrice) : null;
      if ((fixed && unit! <= 0) || (dto.kind === 'commission_agreed' && retail! <= 0)) throw new BadRequestException('Price must be positive');
      const prior = await m.find(CustomerPricingRule, { where: { accountId, productId: dto.productId } });
      const to = dto.effectiveTo || null;
      if (prior.some(p => p.effectiveFrom <= (to || '9999-12-31') && (p.effectiveTo || '9999-12-31') >= dto.effectiveFrom)) {
        throw new BadRequestException('Pricing date range overlaps an existing agreement');
      }
      return m.save(CustomerPricingRule, m.create(CustomerPricingRule, {
        accountId, productId: dto.productId, kind: dto.kind, currency: account.defaultCurrency,
        unitPrice: unit === null ? null : amount(unit),
        commissionPercent: commission === null ? null : amount(commission),
        agreedRetailPrice: retail === null ? null : amount(retail),
        effectiveFrom: dto.effectiveFrom, effectiveTo: to, createdById: user.sub,
      }));
    });
  }

  private async calculate(m: EntityManager, report: WeeklySalesReport) {
    const account = await this.account(m, report.accountId);
    const rules = await m.find(CustomerPricingRule, { where: { accountId: report.accountId } });
    const retailPrices = report.retailPrices || {};
    let total = 0;
    const lines: SalesSettlement['lines'] = [];
    for (const item of report.items) {
      const matches = rules.filter(p => p.productId === item.productId && p.effectiveFrom <= report.weekEnd && (!p.effectiveTo || p.effectiveTo >= report.weekEnd));
      if (matches.length !== 1) throw new BadRequestException('Exactly one active pricing rule required for ' + item.articleNumber + ' at week end');
      const p = matches[0];
      if (p.currency !== account.defaultCurrency) throw new BadRequestException('Pricing currency mismatch for ' + item.articleNumber);
      const commission = p.kind.startsWith('commission') ? percentBps(p.commissionPercent) : null;
      const retail = p.kind === 'commission_actual' ? cents(retailPrices[String(item.productId)]) :
        p.kind === 'commission_agreed' ? cents(p.agreedRetailPrice) : null;
      const unit = commission !== null ? Math.round(retail! * (10000 - commission) / 10000) : cents(p.unitPrice);
      const lineTotal = unit * item.quantity;
      if (!Number.isSafeInteger(lineTotal) || !Number.isSafeInteger(total + lineTotal)) throw new BadRequestException('Settlement amount too large');
      total += lineTotal;
      lines.push({ productId: item.productId, articleNumber: item.articleNumber, quantity: item.quantity,
        pricingRuleId: p.id, kind: p.kind, unitRetailCents: retail, unitSettlementCents: unit,
        commissionBasisPoints: commission, totalCents: lineTotal });
    }
    return { accountId: report.accountId, currency: account.defaultCurrency, totalCents: String(total), lines };
  }

  async preview(reportId: number) {
    const report = await this.db.manager.findOne(WeeklySalesReport, { where: { id: reportId } });
    if (!report) throw new NotFoundException('Report not found');
    if (report.status !== 'draft') throw new BadRequestException('Only drafts can be previewed');
    return this.calculate(this.db.manager, report);
  }

  async createSettlement(m: EntityManager, report: WeeklySalesReport) {
    const existing = await m.findOne(SalesSettlement, { where: { reportId: report.id } });
    if (existing) throw new BadRequestException('Settlement already exists');
    const data = await this.calculate(m, report);
    return m.save(SalesSettlement, m.create(SalesSettlement, { reportId: report.id, ...data, status: 'active' }));
  }

  async reverseSettlement(m: EntityManager, reportId: number) {
    const settlement = await m.findOne(SalesSettlement, { where: { reportId } });
    if (!settlement) return;
    if (settlement.status !== 'active') throw new BadRequestException('Settlement already reversed');
    if (await m.exists(PaymentAllocation, { where: { settlementId: settlement.id } })) {
      throw new BadRequestException('Report has allocated payments. Reconcile those payments before cancellation.');
    }
    settlement.status = 'reversed';
    settlement.reversedAt = new Date();
    await m.save(SalesSettlement, settlement);
  }

  async overview(accountId: number) {
    const account = await this.account(this.db.manager, accountId);
    const settlements = await this.db.getRepository(SalesSettlement).find({ where: { accountId }, order: { id: 'DESC' } });
    const payments = await this.db.getRepository(CustomerPayment).find({ where: { accountId }, order: { id: 'DESC' } });
    const paymentIds = payments.map(p => p.id);
    const allocations = paymentIds.length ? await this.db.getRepository(PaymentAllocation)
      .createQueryBuilder('a').where('a.payment_id IN (:...ids)', { ids: paymentIds }).getMany() : [];
    const allocated = (id: number, field: 'settlementId' | 'paymentId') =>
      allocations.filter(a => a[field] === id).reduce((sum, a) => sum + Number(a.amountCents), 0);
    const reportBalances = settlements.map(s => ({
      ...s, total: amount(Number(s.totalCents)), paid: amount(allocated(s.id, 'settlementId')),
      outstanding: amount(s.status === 'active' ? Number(s.totalCents) - allocated(s.id, 'settlementId') : 0),
    }));
    const paymentBalances = payments.map(p => ({
      ...p,
      amount: amount(Number(p.amountCents)),
      allocated: amount(allocated(p.id, 'paymentId')),
      unallocated: amount(Number(p.amountCents) - allocated(p.id, 'paymentId')),
    }));
    const currencies = [...new Set([...settlements.map(s => s.currency), ...payments.map(p => p.currency)])].sort();
    const byCurrency = currencies.map(currency => {
      const active = settlements.filter(s => s.currency === currency && s.status === 'active');
      const sameCurrencyPayments = payments.filter(p => p.currency === currency);
      const owedCents = active.reduce((n, s) => n + Number(s.totalCents), 0);
      const outstandingCents = active.reduce((n, s) => n + Number(s.totalCents) - allocated(s.id, 'settlementId'), 0);
      const unallocatedCents = sameCurrencyPayments.reduce((n, p) => n + Number(p.amountCents) - allocated(p.id, 'paymentId'), 0);
      return {
        currency,
        totalOwed: amount(owedCents),
        outstanding: amount(outstandingCents),
        unallocatedCredit: amount(unallocatedCents),
        netExposure: amount(outstandingCents - unallocatedCents),
      };
    });
    const current = byCurrency.find(row => row.currency === account.defaultCurrency);
    return {
      currency: account.defaultCurrency,
      totalOwed: current?.totalOwed || '0.00',
      outstanding: current?.outstanding || '0.00',
      unallocatedCredit: current?.unallocatedCredit || '0.00',
      netExposure: current?.netExposure || '0.00',
      byCurrency,
      settlements: reportBalances,
      payments: paymentBalances,
      allocations,
    };
  }

  async recordPayment(accountId: number, dto: { amount: string; paymentDate: string; reference: string; method: string }, user: ActiveUser) {
    return this.db.transaction(async m => {
      const account = await this.account(m, accountId, true);
      const value = cents(dto.amount);
      if (value <= 0 || !dateOk(dto.paymentDate) || !dto.reference?.trim() || dto.reference.length > 150 ||
        !['bank_transfer', 'cash', 'card', 'other'].includes(dto.method)) throw new BadRequestException('Invalid payment details');
      return m.save(CustomerPayment, m.create(CustomerPayment, {
        accountId, amountCents: String(value), currency: account.defaultCurrency, paymentDate: dto.paymentDate,
        reference: dto.reference.trim(), method: dto.method, createdById: user.sub,
      }));
    });
  }

  async allocate(accountId: number, dto: { paymentId: number; settlementId: number; amount: string }, user: ActiveUser) {
    return this.db.transaction(async m => {
      await this.account(m, accountId, true);
      const value = cents(dto.amount);
      if (value <= 0 || !Number.isInteger(dto.paymentId) || !Number.isInteger(dto.settlementId)) throw new BadRequestException('Invalid allocation');
      const payment = await m.findOne(CustomerPayment, { where: { id: dto.paymentId, accountId } });
      const settlement = await m.findOne(SalesSettlement, { where: { id: dto.settlementId, accountId } });
      if (!payment || !settlement || settlement.status !== 'active' || payment.currency !== settlement.currency) throw new BadRequestException('Payment or active settlement not found');
      if (await m.exists(PaymentAllocation, { where: { paymentId: payment.id, settlementId: settlement.id } })) throw new BadRequestException('Payment already allocated to this settlement');
      const usedPayment = await m.find(PaymentAllocation, { where: { paymentId: payment.id } });
      const usedSettlement = await m.find(PaymentAllocation, { where: { settlementId: settlement.id } });
      if (usedPayment.reduce((n, a) => n + Number(a.amountCents), 0) + value > Number(payment.amountCents) ||
        usedSettlement.reduce((n, a) => n + Number(a.amountCents), 0) + value > Number(settlement.totalCents)) {
        throw new BadRequestException('Allocation exceeds unallocated payment or outstanding settlement');
      }
      return m.save(PaymentAllocation, m.create(PaymentAllocation, {
        paymentId: payment.id, settlementId: settlement.id, amountCents: String(value), createdById: user.sub,
      }));
    });
  }
}
