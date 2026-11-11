import { BadRequestException } from '@nestjs/common';
import { AccountType } from '../accounting/entities/accounting-account.entity';
import { JournalEntryType } from '../accounting/entities/journal-entry.entity';
import type { PostAccountingEvent } from '../accounting/accounting-posting.service';

/**
 * Phase 2A only: pure EGP supplier-settlement policy.
 *
 * IMPORTANT: not wired into PaymentsService, InvoicesService, API routes or any
 * migration. Existing invoice and payment posting behavior is unchanged.
 * Currency/amount checks here do not implement an FX settlement policy.
 */
export interface SupplierInvoiceFixture {
  id: number;
  type: 'incoming' | 'outgoing';
  status: string;
  currency: string;
  totalCents: number;
  alreadyPaidCents: number;
}

export interface SupplierPaymentFixture {
  id: number;
  invoiceId: number;
  date: string;
  amountCents: number;
  currency: string;
  bankAccountId: number;
  reference?: string;
}

export interface SettlementAccountFixture {
  id: number;
  code: string;
  type: AccountType;
  currency: string;
  isActive: boolean;
  isLeaf: boolean;
}

const money = (value: number, name: string): void => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new BadRequestException(`${name} must be a nonnegative integer amount of EGP cents`);
  }
};
const positiveId = (value: number, label: string): void => {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new BadRequestException(`Invalid ${label}`);
  }
};

export function calculateSupplierSettlement(
  invoice: SupplierInvoiceFixture,
  paymentCents: number,
): { status: 'partially_paid' | 'paid'; paidCents: number; remainingCents: number } {
  positiveId(invoice.id, 'invoice ID');
  if (invoice.type !== 'incoming' || invoice.currency !== 'EGP') {
    throw new BadRequestException('Phase 2A supports EGP supplier invoices only');
  }
  if (!['sent', 'overdue', 'partially_paid'].includes(invoice.status)) {
    throw new BadRequestException('Supplier invoice must be issued and have an outstanding balance');
  }
  money(invoice.totalCents, 'Invoice total');
  money(invoice.alreadyPaidCents, 'Already paid');
  money(paymentCents, 'New payment');
  if (invoice.totalCents === 0 || paymentCents === 0) {
    throw new BadRequestException('Invoice total and payment must be positive');
  }
  const paidCents = invoice.alreadyPaidCents + paymentCents;
  if (!Number.isSafeInteger(paidCents) || paidCents > invoice.totalCents) {
    throw new BadRequestException('Payment exceeds the outstanding supplier invoice amount');
  }
  return {
    status: paidCents === invoice.totalCents ? 'paid' : 'partially_paid',
    paidCents,
    remainingCents: invoice.totalCents - paidCents,
  };
}

export function buildSupplierSettlementEvent(
  invoice: SupplierInvoiceFixture,
  payment: SupplierPaymentFixture,
  payableAccount: SettlementAccountFixture,
  bankAccount: SettlementAccountFixture,
): PostAccountingEvent {
  positiveId(payment.id, 'payment ID');
  positiveId(payment.invoiceId, 'payment invoice ID');
  if (invoice.id !== payment.invoiceId || payment.currency !== 'EGP') {
    throw new BadRequestException('Payment must belong to the same EGP supplier invoice');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payment.date) ||
      Number.isNaN(Date.parse(payment.date)) ||
      new Date(payment.date).toISOString().slice(0, 10) !== payment.date) {
    throw new BadRequestException('Payment date is invalid');
  }
  calculateSupplierSettlement(invoice, payment.amountCents);
  if (payment.bankAccountId !== bankAccount.id ||
      payableAccount.id === bankAccount.id ||
      payableAccount.type !== AccountType.LIABILITY ||
      payableAccount.code !== '2100' ||
      bankAccount.type !== AccountType.ASSET ||
      !bankAccount.code.startsWith('11') ||
      ![payableAccount, bankAccount].every(a =>
        Number.isSafeInteger(a.id) && a.id > 0 &&
        a.currency === 'EGP' && a.isActive && a.isLeaf)) {
    throw new BadRequestException('Choose a valid EGP Accounts Payable account and EGP bank/cash account');
  }
  if (payment.reference && payment.reference.length > 100) {
    throw new BadRequestException('Payment reference is too long');
  }

  return {
    sourceEventKey: `supplier-payment:${payment.id}:posted:v1`,
    type: JournalEntryType.PAYMENT,
    date: payment.date,
    description: `Supplier invoice #${invoice.id} payment #${payment.id}`,
    reference: payment.reference?.trim() || `SUP-PAY-${payment.id}`,
    lines: [
      { accountId: payableAccount.id, debitCents: payment.amountCents, creditCents: 0 },
      { accountId: bankAccount.id, debitCents: 0, creditCents: payment.amountCents },
    ],
  };
}
