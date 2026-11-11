import {
  BadRequestException, ConflictException, ForbiddenException,
  Injectable, NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { Payment } from './entities/payment.entity';
import { Invoice, InvoiceType, InvoiceStatus } from '../invoices/entities/invoice.entity';
import { AccountingAccount, AccountType } from '../accounting/entities/accounting-account.entity';
import { JournalEntry, JournalEntryType } from '../accounting/entities/journal-entry.entity';
import { JournalLine } from '../accounting/entities/journal-line.entity';
import {
  buildSupplierSettlementEvent, calculateSupplierSettlement,
} from './supplier-settlement.policy';

export interface CreateSupplierEgpPilotPayment {
  invoiceId: number;
  bankAccountId: number;
  amountCents: number;
  date: string;
  requestKey: string; // UUID generated once per user submission, persisted in payment.reference
  description?: string;
}

/**
 * Disabled-by-default, TEST DATABASE ONLY Phase 2B pilot. Does not change
 * existing /payments, invoice or PO routes.
 *
 * The lock is per-invoice, making duplicate requests and concurrent partial
 * payments serialize. The old invoice synthetic-payment posting is bypassed.
 */
@Injectable()
export class SupplierEgpPilotService {
  constructor(private readonly db: DataSource) {}

  private ensurePilotEnabled(): void {
    if (process.env.SUPPLIER_EGP_PILOT !== 'true' ||
        process.env.DATABASE_NAME !== 'kora_test' ||
        !['localhost', '127.0.0.1', '::1'].includes(process.env.DATABASE_HOST || '127.0.0.1')) {
      throw new ForbiddenException('Supplier settlement pilot is disabled outside local kora_test');
    }
  }

  private static cents(value: number, name: string): number {
    const scaled = Number(value) * 100;
    const rounded = Math.round(scaled);
    if (!Number.isSafeInteger(rounded) || Math.abs(scaled - rounded) > 0.000001 || rounded < 0) {
      throw new BadRequestException(`${name} must have at most two decimal places`);
    }
    return rounded;
  }

  private async getAccount(m: EntityManager, id: number) {
    const a = await m.findOne(AccountingAccount, { where: { id } });
    if (!a) throw new NotFoundException(`Accounting account ${id} not found`);
    return {
      id: a.id, code: a.code, type: a.type, currency: a.currency,
      isActive: a.isActive,
      isLeaf: !(await m.exists(AccountingAccount, { where: { parentId: id } })),
    };
  }

  async create(input: CreateSupplierEgpPilotPayment): Promise<{
    paymentId: number; journalId: number; status: string; remainingCents: number; replayed: boolean;
  }> {
    this.ensurePilotEnabled();
    if (!Number.isSafeInteger(input?.invoiceId) || input.invoiceId <= 0 ||
        !Number.isSafeInteger(input?.bankAccountId) || input.bankAccountId <= 0 ||
        !Number.isSafeInteger(input?.amountCents) || input.amountCents <= 0 ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input?.requestKey || '') ||
        !/^\d{4}-\d{2}-\d{2}$/.test(input?.date || '') ||
        Number.isNaN(Date.parse(input.date)) ||
        new Date(input.date).toISOString().slice(0, 10) !== input.date ||
        (input.description?.length || 0) > 255) {
      throw new BadRequestException('Invalid EGP supplier payment fields or request key');
    }
    const ref = `SEGP-${input.requestKey.toLowerCase()}`;

    return this.db.transaction('SERIALIZABLE', async (m) => {
      // Fail closed even when the environment points to an unexpected database.
      const [identity] = await m.query('SELECT current_database() AS database_name');
      if (identity?.database_name !== 'kora_test') {
        throw new ForbiddenException('Supplier pilot can only write to kora_test');
      }

      // Serialize retries of the same request key even across different invoices.
      // Two int32 advisory keys: domain-specific namespace and hash of UUID.
      await m.query('SELECT pg_advisory_xact_lock($1::int, hashtext($2))', [824613, ref]);

      // Locked invoice provides stable serialization for every payment to it.
      const invoice = await m.findOne(Invoice, {
        where: { id: input.invoiceId }, lock: { mode: 'pessimistic_write' },
      });
      if (!invoice) throw new NotFoundException('Supplier invoice not found');
      if (invoice.type !== InvoiceType.INCOMING || invoice.currency !== 'EGP') {
        throw new BadRequestException('Only EGP incoming supplier invoices are supported');
      }

      // Request identity is persisted in the existing reference column. Check
      // before the paid-state restriction to make completed requests retryable.
      const prior = await m.findOne(Payment, { where: { reference: ref } });
      if (prior) {
        if (prior.invoiceId !== input.invoiceId ||
            prior.paidFromAccountId !== input.bankAccountId ||
            SupplierEgpPilotService.cents(prior.amount, 'Previous payment') !== input.amountCents ||
            String(prior.date).slice(0, 10) !== input.date) {
          throw new ConflictException('Request key was already used for different payment details');
        }
        const posted = await m.findOne(JournalEntry, {
          where: { sourceEventKey: `supplier-payment:${prior.id}:posted:v1` },
        });
        if (!posted || posted.postingStatus !== 'posted') {
          throw new ConflictException('Existing payment is missing its posted journal; manual review required');
        }
        const payments = await m.find(Payment, { where: { invoiceId: invoice.id } });
        const remaining = SupplierEgpPilotService.cents(invoice.total, 'Invoice total') -
          payments.reduce((sum, p) => sum + SupplierEgpPilotService.cents(p.amount, 'Payment'), 0);
        return {
          paymentId: prior.id, journalId: posted.id, status: invoice.status,
          remainingCents: remaining, replayed: true,
        };
      }

      if (!['sent', 'overdue', 'partially_paid'].includes(invoice.status)) {
        throw new BadRequestException('Supplier invoice must be issued and outstanding');
      }
      // The invoice must already have been booked as AP before settling it.
      const booked = await m.find(JournalEntry, {
        where: { invoiceId: invoice.id, type: JournalEntryType.INVOICE },
      });
      if (booked.length !== 1 || booked[0].postingStatus !== 'posted') {
        throw new ConflictException('Invoice requires exactly one posted booking journal before payment');
      }
      // Do not settle an invoice that was already given a synthetic PAID journal
      // by the legacy mechanism or any other payment journal.
      const paymentJournals = await m.find(JournalEntry, {
        where: { invoiceId: invoice.id, type: JournalEntryType.PAYMENT },
      });
      const payments = await m.find(Payment, { where: { invoiceId: invoice.id } });
      if (payments.some(p => p.currency !== 'EGP' || Number(p.exchangeRate) !== 1) ||
          paymentJournals.some(j => j.sourceEventKey == null ||
            !j.sourceEventKey.startsWith('supplier-payment:')) ||
          paymentJournals.length !== payments.length) {
        throw new ConflictException('Invoice has legacy or ambiguous payments; pilot refuses to alter it');
      }

      const alreadyPaidCents = payments.reduce(
        (sum, p) => sum + SupplierEgpPilotService.cents(p.amount, 'Prior payment'), 0,
      );
      const summary = calculateSupplierSettlement({
        id: invoice.id, type: 'incoming', status: invoice.status,
        currency: invoice.currency,
        totalCents: SupplierEgpPilotService.cents(invoice.total, 'Invoice total'),
        alreadyPaidCents,
      }, input.amountCents);

      const ap = await m.findOne(AccountingAccount, { where: { code: '2100' } });
      if (!ap) throw new ConflictException('EGP Accounts Payable posting account 2100 is missing');
      const apAccount = await this.getAccount(m, ap.id);
      const bankAccount = await this.getAccount(m, input.bankAccountId);

      const payment = m.create(Payment, {
        invoiceId: invoice.id,
        date: input.date,
        amount: input.amountCents / 100,
        currency: 'EGP',
        exchangeRate: 1,
        amountBase: input.amountCents / 100,
        amountEgp: input.amountCents / 100,
        method: 'bank_transfer',
        reference: ref,
        description: input.description?.trim() || `EGP supplier invoice ${invoice.number} settlement`,
        paidFromAccountId: bankAccount.id,
        categoryAccountId: apAccount.id,
        poId: invoice.poId || null,
      });
      // Both payment and journal are persisted inside the SAME DB transaction.
      const saved = await m.save(Payment, payment);
      const event = buildSupplierSettlementEvent({
        id: invoice.id, type: 'incoming', status: invoice.status,
        currency: invoice.currency,
        totalCents: SupplierEgpPilotService.cents(invoice.total, 'Invoice total'),
        alreadyPaidCents,
      }, {
        id: saved.id, invoiceId: invoice.id, date: input.date,
        amountCents: input.amountCents, currency: 'EGP',
        bankAccountId: bankAccount.id, reference: ref,
      }, apAccount, bankAccount);

      const journal = m.create(JournalEntry, {
        type: event.type,
        invoiceId: invoice.id,
        poId: invoice.poId || null,
        date: event.date,
        description: event.description,
        reference: event.reference,
        sourceEventKey: event.sourceEventKey,
        postingStatus: 'posted',
        postedAt: new Date(),
        lines: event.lines.map(l => {
          const amount = (l.debitCents - l.creditCents) / 100;
          return m.create(JournalLine, {
            accountId: l.accountId, debit: l.debitCents / 100,
            credit: l.creditCents / 100,
            currency: 'EGP', exchangeRate: 1,
            amountBase: amount, amountEgp: amount,
          });
        }),
      });
      const posted = await m.save(JournalEntry, journal);
      invoice.status = summary.status as InvoiceStatus;
      await m.save(Invoice, invoice); // Crucial: bypass InvoicesService.update synthetic payment posting.
      return {
        paymentId: saved.id, journalId: posted.id,
        status: summary.status, remainingCents: summary.remainingCents, replayed: false,
      };
    });
  }
}
