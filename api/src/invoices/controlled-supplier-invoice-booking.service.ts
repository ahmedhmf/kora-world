import {
  BadRequestException, ConflictException, ForbiddenException,
  Injectable, NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { Invoice, InvoiceStatus, InvoiceType } from './entities/invoice.entity';
import { Payment } from '../payments/entities/payment.entity';
import { AccountingAccount, AccountType } from '../accounting/entities/accounting-account.entity';
import { JournalEntry, JournalEntryType } from '../accounting/entities/journal-entry.entity';
import { JournalLine } from '../accounting/entities/journal-line.entity';

export interface ControlledBookingResult {
  invoiceId: number;
  journalId: number;
  status: 'sent';
  replayed: boolean;
}

/**
 * Phase 2I Part 3: intentionally narrow local test-only controlled booking of
 * an EXISTING DRAFT EGP incoming supplier invoice. This is the first invoice
 * half of the already-tested controlled supplier payment workflow.
 *
 * Never converts currency, alters historical journals, or calls legacy
 * InvoicesService.update (which can create synthetic payment entries).
 */
@Injectable()
export class ControlledSupplierInvoiceBookingService {
  constructor(private readonly db: DataSource) {}

  private ensureEnabled() {
    if (process.env.SUPPLIER_EGP_PILOT !== 'true' ||
        process.env.CONTROLLED_INVOICE_BOOKING !== 'true' ||
        process.env.DATABASE_NAME !== 'kora_test' ||
        !['localhost', '127.0.0.1', '::1'].includes(
          process.env.DATABASE_HOST || '127.0.0.1')) {
      throw new ForbiddenException('Controlled supplier booking is disabled outside local kora_test');
    }
  }

  private static cents(value: number, field: string): number {
    const raw = Number(value) * 100;
    const rounded = Math.round(raw);
    if (!Number.isSafeInteger(rounded) || rounded < 0 ||
        Math.abs(raw - rounded) > 0.000001) {
      throw new BadRequestException(`${field} must be a nonnegative EGP amount with two decimals`);
    }
    return rounded;
  }

  private async account(m: EntityManager, code: string, type: AccountType) {
    const account = await m.findOne(AccountingAccount, { where: { code } });
    if (!account || account.type !== type ||
        account.currency !== 'EGP' || !account.isActive ||
        await m.exists(AccountingAccount, { where: { parentId: account.id } })) {
      throw new ConflictException(`Account ${code} must be an active leaf EGP ${type} account`);
    }
    return account.id;
  }

  async post(invoiceId: number): Promise<ControlledBookingResult> {
    this.ensureEnabled();
    if (!Number.isSafeInteger(invoiceId) || invoiceId <= 0) {
      throw new BadRequestException('Invalid invoice ID');
    }

    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await this.db.transaction('SERIALIZABLE', async m => {
          const [identity] = await m.query('SELECT current_database() AS database_name');
          if (identity?.database_name !== 'kora_test') {
            throw new ForbiddenException('Controlled supplier booking may only write to kora_test');
          }
          // Lock the invoice so two concurrent booking requests cannot create
          // two journals, even when they run on different application nodes.
          const invoice = await m.findOne(Invoice, {
            where: { id: invoiceId }, lock: { mode: 'pessimistic_write' },
          });
          if (!invoice) throw new NotFoundException('Invoice not found');
          if (invoice.type !== InvoiceType.INCOMING || invoice.currency !== 'EGP') {
            throw new BadRequestException('Only existing EGP incoming supplier invoices may be booked');
          }
          const sourceKey = `supplier-invoice:${invoice.id}:booked:v1`;
          const journals = await m.find(JournalEntry, { where: { invoiceId: invoice.id } });
          const payments = await m.find(Payment, { where: { invoiceId: invoice.id } });

          // A replay is allowed only for the exact one verified posted booking,
          // without any other journals/payments or conflicting historical data.
          if (invoice.status === InvoiceStatus.SENT && payments.length === 0 &&
              journals.length === 1 && journals[0].type === JournalEntryType.INVOICE &&
              journals[0].sourceEventKey === sourceKey &&
              journals[0].postingStatus === 'posted' && !journals[0].reversalOfId) {
            return {
              invoiceId: invoice.id, journalId: journals[0].id,
              status: 'sent' as const, replayed: true,
            };
          }
          if (invoice.status !== InvoiceStatus.DRAFT ||
              journals.length !== 0 || payments.length !== 0) {
            throw new ConflictException('Invoice has prior posting or payment history; manual reconciliation required');
          }

          const subtotal = ControlledSupplierInvoiceBookingService.cents(invoice.subtotal, 'Subtotal');
          const tax = ControlledSupplierInvoiceBookingService.cents(invoice.tax, 'Tax');
          const total = ControlledSupplierInvoiceBookingService.cents(invoice.total, 'Invoice total');
          if (total <= 0 || subtotal <= 0 || subtotal + tax !== total ||
              !Number.isSafeInteger(subtotal + tax)) {
            throw new ConflictException('Invoice total must equal subtotal plus tax');
          }

          const expenseId = await this.account(m, '5100', AccountType.EXPENSE);
          const payableId = await this.account(m, '2100', AccountType.LIABILITY);
          const taxId = tax > 0 ? await this.account(m, '2200', AccountType.LIABILITY) : null;

          const lines: Array<{ accountId: number; debitCents: number; creditCents: number }> = [
            { accountId: expenseId, debitCents: subtotal, creditCents: 0 },
          ];
          if (taxId !== null) lines.push({ accountId: taxId, debitCents: tax, creditCents: 0 });
          lines.push({ accountId: payableId, debitCents: 0, creditCents: total });

          const date = typeof invoice.date === 'string'
            ? invoice.date.slice(0, 10)
            : invoice.date.toISOString().slice(0, 10);
          const journal = m.create(JournalEntry, {
            invoiceId: invoice.id,
            poId: invoice.poId || null,
            date,
            type: JournalEntryType.INVOICE,
            description: `Controlled EGP supplier invoice booking ${invoice.number}`,
            reference: invoice.number,
            sourceEventKey: sourceKey,
            postingStatus: 'posted',
            postedAt: new Date(),
            lines: lines.map(l => {
              const amount = (l.debitCents - l.creditCents) / 100;
              return m.create(JournalLine, {
                accountId: l.accountId,
                debit: l.debitCents / 100, credit: l.creditCents / 100,
                currency: 'EGP', exchangeRate: 1,
                amountBase: amount, amountEgp: amount,
              });
            }),
          });
          const saved = await m.save(JournalEntry, journal);
          invoice.status = InvoiceStatus.SENT;
          await m.save(Invoice, invoice);
          return {
            invoiceId: invoice.id, journalId: saved.id,
            status: 'sent' as const, replayed: false,
          };
        });
      } catch (error) {
        const e = error as { code?: string; driverError?: { code?: string } };
        if ((e?.driverError?.code || e?.code) === '40001' && attempt < maxAttempts) {
          continue;
        }
        throw error;
      }
    }
    throw new ConflictException('Controlled booking could not complete');
  }
}
