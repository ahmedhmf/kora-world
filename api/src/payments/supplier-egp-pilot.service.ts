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
import { User } from '../users/entities/user.entity';
import {
  buildSupplierSettlementEvent, calculateSupplierSettlement,
} from './supplier-settlement.policy';

export interface CreateSupplierEgpPilotPayment {
  invoiceId: number;
  bankAccountId: number;
  amountCents: number;
  date: string;
  requestKey: string; // Stable client UUID persisted as a uniquely indexed payment request key
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

  /**
   * Retry only PostgreSQL SERIALIZABLE conflicts (SQLSTATE 40001).
   * A failed transaction is rolled back by TypeORM before the next attempt.
   * All retries keep the original request UUID, so a prior successful commit
   * is detected as a replay rather than posted again.
   */
  private async withSerializationRetry<T>(work: () => Promise<T>): Promise<T> {
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await work();
      } catch (error) {
        const err = error as { code?: string; driverError?: { code?: string } };
        const sqlstate = err?.driverError?.code || err?.code;
        if (sqlstate !== '40001' || attempt === maxAttempts) {
          throw error;
        }
        // Short bounded delay, without increasing the number of transactions
        // in flight. No retry for overpayments, uniqueness, or validation.
        await new Promise<void>(resolve => setTimeout(resolve, 15 * attempt));
      }
    }
    throw new Error('Unreachable serialization retry state');
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

  private async settlementHistory(m: EntityManager, invoiceId: number): Promise<{
    paidCents: number;
    payments: Payment[];
    originals: JournalEntry[];
  }> {
    const payments = await m.find(Payment, { where: { invoiceId } });
    const entries = await m.find(JournalEntry, {
      where: { invoiceId, type: JournalEntryType.PAYMENT },
    });
    const originals = entries.filter(j => !j.reversalOfId);
    const reversals = entries.filter(j => !!j.reversalOfId);
    if (payments.length !== originals.length || reversals.length > originals.length ||
        payments.some(p => p.currency !== 'EGP' || Number(p.exchangeRate) !== 1)) {
      throw new ConflictException('Supplier invoice has ambiguous payment history');
    }
    let paidCents = 0;
    const originalIds = new Set<number>();
    for (const p of payments) {
      const sourceKey = `supplier-payment:${p.id}:posted:v1`;
      const journal = originals.find(j => j.sourceEventKey === sourceKey);
      if (!journal || originalIds.has(journal.id)) {
        throw new ConflictException('Supplier invoice has legacy or unlinked payment journals');
      }
      originalIds.add(journal.id);
      const linkedReversals = reversals.filter(j => j.reversalOfId === journal.id);
      if (linkedReversals.length > 1) throw new ConflictException('Duplicate supplier payment reversal');
      if (journal.postingStatus === 'posted' && linkedReversals.length === 0) {
        paidCents += SupplierEgpPilotService.cents(p.amount, 'Payment');
        if (!Number.isSafeInteger(paidCents)) throw new ConflictException('Payment sum exceeds supported range');
      } else if (journal.postingStatus === 'reversed' && linkedReversals.length === 1 &&
          linkedReversals[0].postingStatus === 'posted' &&
          linkedReversals[0].sourceEventKey === `supplier-payment:${p.id}:reversal:v1`) {
        // Retained payment row is not an active settlement.
      } else {
        throw new ConflictException('Inconsistent supplier payment reversal history');
      }
    }
    if (reversals.some(j => !originalIds.has(j.reversalOfId!))) {
      throw new ConflictException('Orphaned supplier payment reversal');
    }
    return { paidCents, payments, originals };
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
    const requestKey = input.requestKey.toLowerCase();

    return this.withSerializationRetry(() => this.db.transaction('SERIALIZABLE', async (m) => {
      // Fail closed even when the environment points to an unexpected database.
      const [identity] = await m.query('SELECT current_database() AS database_name');
      if (identity?.database_name !== 'kora_test') {
        throw new ForbiddenException('Supplier pilot can only write to kora_test');
      }

      // Serialize retries of the same request key even across different invoices.
      // Two int32 advisory keys: domain-specific namespace and hash of UUID.
      await m.query('SELECT pg_advisory_xact_lock($1::int, hashtext($2))', [824613, requestKey]);

      // Locked invoice provides stable serialization for every payment to it.
      const invoice = await m.findOne(Invoice, {
        where: { id: input.invoiceId }, lock: { mode: 'pessimistic_write' },
      });
      if (!invoice) throw new NotFoundException('Supplier invoice not found');
      if (invoice.type !== InvoiceType.INCOMING || invoice.currency !== 'EGP') {
        throw new BadRequestException('Only EGP incoming supplier invoices are supported');
      }

      // The pilot schema is installed explicitly on disposable local kora_test.
      // No request-key column is added to the shared Payment entity until the
      // production schema rollout has been separately reviewed.
      const column = await m.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema='public' AND table_name='payments'
            AND column_name='request_key' AND data_type='uuid'
        ) AS ready
      `);
      if (!column[0]?.ready) {
        throw new ConflictException('Local test database requires the supplier request-key schema preparation');
      }
      // Look up by the dedicated UUID column, not the mutable payment reference.
      const existing = await m.query(
        'SELECT id FROM public.payments WHERE request_key = $1::uuid', [requestKey],
      );
      const prior = existing.length
        ? await m.findOne(Payment, { where: { id: Number(existing[0].id) } })
        : null;
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
        if (!posted) {
          throw new ConflictException('Existing payment is missing its journal; manual review required');
        }
        if (posted.postingStatus !== 'posted') {
          throw new ConflictException('Reversed payment cannot be replayed as a new settlement');
        }
        const history = await this.settlementHistory(m, invoice.id);
        const remaining = SupplierEgpPilotService.cents(invoice.total, 'Invoice total') - history.paidCents;
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
      // Reversed payments remain in the database for audit, but are excluded
      // from the amount currently settled. Reject any ambiguous legacy history.
      const history = await this.settlementHistory(m, invoice.id);
      const alreadyPaidCents = history.paidCents;
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
        description: input.description?.trim() || `EGP supplier invoice ${invoice.number} settlement`,
        paidFromAccountId: bankAccount.id,
        categoryAccountId: apAccount.id,
        poId: invoice.poId || null,
      });
      // Both payment and journal are persisted inside the SAME DB transaction.
      const saved = await m.save(Payment, payment);
      // Unique PostgreSQL index enforces at most one persisted Payment per UUID,
      // including calls from other processes. This update is in the same
      // transaction as payment, journal and invoice-status writes.
      await m.query(
        'UPDATE public.payments SET request_key = $1::uuid, reference = $2 WHERE id = $3',
        [requestKey, `SUP-PAY-${saved.id}`, saved.id],
      );
      const event = buildSupplierSettlementEvent({
        id: invoice.id, type: 'incoming', status: invoice.status,
        currency: invoice.currency,
        totalCents: SupplierEgpPilotService.cents(invoice.total, 'Invoice total'),
        alreadyPaidCents,
      }, {
        id: saved.id, invoiceId: invoice.id, date: input.date,
        amountCents: input.amountCents, currency: 'EGP',
        bankAccountId: bankAccount.id, reference: `SUP-PAY-${saved.id}`,
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
    })).catch((error: unknown) => {
      // A duplicate UUID is a deterministic conflict, not a serialization
      // retry. The unique index is authoritative even across application nodes.
      const err = error as { code?: string; driverError?: { code?: string; constraint?: string } };
      if ((err?.driverError?.code || err?.code) === '23505' &&
          err?.driverError?.constraint === 'uq_payments_request_key') {
        throw new ConflictException('Supplier payment request key already exists');
      }
      throw error;
    });
  }

  async reverse(paymentId: number, actorId: number, reason: string): Promise<{
    paymentId: number; originalJournalId: number; reversalJournalId: number;
    status: string; remainingCents: number;
  }> {
    this.ensurePilotEnabled();
    if (!Number.isSafeInteger(paymentId) || paymentId <= 0 ||
        !Number.isSafeInteger(actorId) || actorId <= 0 ||
        !reason?.trim() || reason.trim().length > 500) {
      throw new BadRequestException('Valid payment, user, and reversal reason (1-500 characters) are required');
    }
    return this.withSerializationRetry(() => this.db.transaction('SERIALIZABLE', async m => {
      const [identity] = await m.query('SELECT current_database() AS database_name');
      if (identity?.database_name !== 'kora_test') {
        throw new ForbiddenException('Supplier pilot is restricted to local kora_test');
      }
      const actor = await m.findOne(User, { where: { id: actorId } });
      if (!actor || !['accountant', 'admin'].includes(actor.role)) {
        throw new ForbiddenException('Only an accountant or administrator may reverse supplier payments');
      }
      // First find invoice ID without locking, then lock the same invoice row
      // used by create() to serialize payments and corrections.
      const payment = await m.findOne(Payment, { where: { id: paymentId } });
      if (!payment || !payment.invoiceId) throw new NotFoundException('Supplier payment not found');
      const invoice = await m.findOne(Invoice, {
        where: { id: payment.invoiceId }, lock: { mode: 'pessimistic_write' },
      });
      if (!invoice || invoice.type !== InvoiceType.INCOMING || invoice.currency !== 'EGP') {
        throw new ConflictException('Reversal requires an existing EGP supplier invoice');
      }
      const keyRow = await m.query(
        'SELECT request_key FROM public.payments WHERE id = $1', [payment.id],
      );
      if (!keyRow[0]?.request_key) {
        throw new ConflictException('Only pilot payments with a dedicated request key may be reversed');
      }
      const original = await m.findOne(JournalEntry, {
        where: { sourceEventKey: `supplier-payment:${payment.id}:posted:v1` },
      });
      if (!original || original.invoiceId !== invoice.id ||
          original.type !== JournalEntryType.PAYMENT ||
          original.postingStatus !== 'posted') {
        throw new ConflictException('Supplier payment is not eligible for reversal or is already reversed');
      }
      const history = await this.settlementHistory(m, invoice.id);
      const currentPaid = history.paidCents;
      const paymentCents = SupplierEgpPilotService.cents(payment.amount, 'Payment');
      if (currentPaid < paymentCents) throw new ConflictException('Inconsistent payment total');
      const lines = await m.find(JournalLine, {
        where: { journalEntryId: original.id }, order: { id: 'ASC' },
      });
      if (lines.length !== 2 ||
          lines.some(l => l.currency !== 'EGP' || Number(l.exchangeRate) !== 1) ||
          !lines.some(l => l.accountId === payment.categoryAccountId &&
            SupplierEgpPilotService.cents(l.debit, 'AP debit') === paymentCents &&
            SupplierEgpPilotService.cents(l.credit, 'AP credit') === 0) ||
          !lines.some(l => l.accountId === payment.paidFromAccountId &&
            SupplierEgpPilotService.cents(l.credit, 'Bank credit') === paymentCents &&
            SupplierEgpPilotService.cents(l.debit, 'Bank debit') === 0)) {
        throw new ConflictException('Supplier settlement journal does not match its payment');
      }
      const existing = await m.findOne(JournalEntry, { where: { reversalOfId: original.id } });
      if (existing) throw new ConflictException('Payment already has a reversal journal');
      const now = new Date();
      const reversal = m.create(JournalEntry, {
        date: now.toISOString().slice(0, 10),
        description: `Supplier payment #${payment.id} reversed: ${reason.trim()}`,
        reference: `REV-${original.id}`,
        invoiceId: invoice.id,
        poId: original.poId || null,
        type: JournalEntryType.PAYMENT,
        reversalOfId: original.id,
        sourceEventKey: `supplier-payment:${payment.id}:reversal:v1`,
        postingStatus: 'posted',
        createdById: actorId,
        approvedById: actorId,
        postedAt: now,
        lines: lines.map(l => m.create(JournalLine, {
          accountId: l.accountId,
          debit: l.credit, credit: l.debit,
          currency: 'EGP', exchangeRate: 1,
          amountBase: -Number(l.amountBase),
          amountEgp: -Number(l.amountEgp),
        })),
      });
      const posted = await m.save(JournalEntry, reversal);
      original.postingStatus = 'reversed';
      original.reversedById = actorId;
      original.reversedAt = now;
      await m.save(JournalEntry, original);
      const remainingPaid = currentPaid - paymentCents;
      const total = SupplierEgpPilotService.cents(invoice.total, 'Invoice total');
      if (remainingPaid > total) throw new ConflictException('Invalid invoice payment balance');
      invoice.status = (remainingPaid === 0
        ? InvoiceStatus.SENT
        : remainingPaid === total ? InvoiceStatus.PAID : 'partially_paid') as InvoiceStatus;
      await m.save(Invoice, invoice);
      return {
        paymentId: payment.id, originalJournalId: original.id,
        reversalJournalId: posted.id,
        status: invoice.status, remainingCents: total - remainingPaid,
      };
    }));
  }
}
