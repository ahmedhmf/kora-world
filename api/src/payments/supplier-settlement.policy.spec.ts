import { BadRequestException } from '@nestjs/common';
import { AccountType } from '../accounting/entities/accounting-account.entity';
import {
  buildSupplierSettlementEvent,
  calculateSupplierSettlement,
} from './supplier-settlement.policy';
import type {
  SupplierInvoiceFixture,
  SupplierPaymentFixture,
  SettlementAccountFixture,
} from './supplier-settlement.policy';

describe('SupplierSettlementPolicy — Phase 2A (no database writes)', () => {
  const invoice: SupplierInvoiceFixture = {
    id: 50, type: 'incoming', status: 'sent', currency: 'EGP',
    totalCents: 100_000, alreadyPaidCents: 0,
  };
  const payment: SupplierPaymentFixture = {
    id: 75, invoiceId: 50, date: '2026-11-11', amountCents: 40_000,
    currency: 'EGP', bankAccountId: 12, reference: 'TRX-75',
  };
  const ap: SettlementAccountFixture = {
    id: 20, code: '2100', type: AccountType.LIABILITY,
    currency: 'EGP', isActive: true, isLeaf: true,
  };
  const bank: SettlementAccountFixture = {
    id: 12, code: '1102', type: AccountType.ASSET,
    currency: 'EGP', isActive: true, isLeaf: true,
  };

  it('recognizes the first partial payment and keeps 600 EGP outstanding', () => {
    expect(calculateSupplierSettlement(invoice, 40_000)).toEqual({
      status: 'partially_paid', paidCents: 40_000, remainingCents: 60_000,
    });
  });

  it('supports multiple instalments, with the final one marking invoice paid', () => {
    const first = calculateSupplierSettlement(invoice, 40_000);
    const second = calculateSupplierSettlement({
      ...invoice, alreadyPaidCents: first.paidCents, status: first.status,
    }, 25_000);
    const third = calculateSupplierSettlement({
      ...invoice, alreadyPaidCents: second.paidCents, status: second.status,
    }, 35_000);
    expect(second.remainingCents).toBe(35_000);
    expect(third).toEqual({ status: 'paid', paidCents: 100_000, remainingCents: 0 });
  });

  it('supports a single full payment', () => {
    expect(calculateSupplierSettlement(invoice, 100_000).status).toBe('paid');
  });

  it('rejects overpayments, including payments beyond prior instalments', () => {
    expect(() => calculateSupplierSettlement(invoice, 100_001)).toThrow(BadRequestException);
    expect(() => calculateSupplierSettlement({
      ...invoice, status: 'partially_paid', alreadyPaidCents: 40_000,
    }, 60_001)).toThrow('exceeds');
  });

  it('rejects zero, negative, fractional cents and unsafe totals', () => {
    for (const value of [0, -10, 1.4, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => calculateSupplierSettlement(invoice, value)).toThrow(BadRequestException);
    }
  });

  it('rejects payments against draft, cancelled, or fully paid invoices', () => {
    for (const status of ['draft', 'cancelled', 'paid']) {
      expect(() => calculateSupplierSettlement({ ...invoice, status }, 100)).toThrow(BadRequestException);
    }
  });

  it('rejects non-EGP and customer invoice settlements', () => {
    expect(() => calculateSupplierSettlement({ ...invoice, currency: 'USD' }, 100)).toThrow(BadRequestException);
    expect(() => calculateSupplierSettlement({ ...invoice, type: 'outgoing' }, 100)).toThrow(BadRequestException);
  });

  it('builds one balanced journal debiting AP and crediting bank, not expense', () => {
    const event = buildSupplierSettlementEvent(invoice, payment, ap, bank);
    expect(event.type).toBe('payment');
    expect(event.sourceEventKey).toBe('supplier-payment:75:posted:v1');
    expect(event.lines).toEqual([
      { accountId: 20, debitCents: 40_000, creditCents: 0 },
      { accountId: 12, debitCents: 0, creditCents: 40_000 },
    ]);
    expect(event.lines.reduce((n, l) => n + l.debitCents - l.creditCents, 0)).toBe(0);
  });

  it('uses a stable unique event identity for a saved payment regardless of reference', () => {
    const first = buildSupplierSettlementEvent(invoice, payment, ap, bank);
    const retry = buildSupplierSettlementEvent(invoice, { ...payment, reference: 'RETRY-OTHER' }, ap, bank);
    const otherPayment = buildSupplierSettlementEvent(invoice, { ...payment, id: 76 }, ap, bank);
    expect(retry.sourceEventKey).toBe(first.sourceEventKey);
    expect(otherPayment.sourceEventKey).not.toBe(first.sourceEventKey);
  });

  it('refuses a payment attached to a different invoice', () => {
    expect(() => buildSupplierSettlementEvent(
      invoice, { ...payment, invoiceId: 51 }, ap, bank,
    )).toThrow(BadRequestException);
  });

  it('refuses foreign currency payment even on an EGP invoice', () => {
    expect(() => buildSupplierSettlementEvent(
      invoice, { ...payment, currency: 'EUR' }, ap, bank,
    )).toThrow(BadRequestException);
  });

  it('refuses inactive, parent, wrong-type, or non-EGP settlement accounts', () => {
    const invalid = [
      { ...ap, isActive: false }, { ...ap, isLeaf: false },
      { ...ap, type: AccountType.EXPENSE }, { ...ap, currency: 'USD' },
      { ...ap, code: '2200' },
    ];
    for (const badAp of invalid) {
      expect(() => buildSupplierSettlementEvent(invoice, payment, badAp, bank)).toThrow(BadRequestException);
    }
    for (const badBank of [
      { ...bank, type: AccountType.EXPENSE },
      { ...bank, code: '1200' }, { ...bank, currency: 'USD' },
      { ...bank, isActive: false }, { ...bank, isLeaf: false },
    ]) {
      expect(() => buildSupplierSettlementEvent(invoice, payment, ap, badBank)).toThrow(BadRequestException);
    }
  });

  it('rejects mismatched selected payment bank ID in the caller-facing fixture', () => {
    // Payment bank selection must match the account validated for posting.
    // That invariant is checked in the policy.
    expect(() => buildSupplierSettlementEvent(invoice, payment, ap, { ...bank, id: 13 }))
      .toThrow(BadRequestException);
  });
});
