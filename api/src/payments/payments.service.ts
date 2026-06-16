import { Injectable, BadRequestException, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from './entities/payment.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { InvoicesService } from '../invoices/invoices.service';
import { AccountingService } from '../accounting/accounting.service';
import { Invoice, InvoiceStatus, InvoiceType } from '../invoices/entities/invoice.entity';
import { JournalEntryType } from '../accounting/entities/journal-entry.entity';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @Inject(forwardRef(() => InvoicesService))
    private readonly invoicesService: InvoicesService,
    @Inject(forwardRef(() => AccountingService))
    private readonly accountingService: AccountingService,
  ) {}

  async create(dto: CreatePaymentDto): Promise<Payment> {
    let invoice: Invoice | null = null;
    if (dto.invoiceId) {
      invoice = await this.invoicesService.findOne(dto.invoiceId);
      if (!invoice) {
        throw new NotFoundException(`Invoice with ID ${dto.invoiceId} not found`);
      }
    }

    const currency = dto.currency.toUpperCase();
    let rate = dto.exchangeRate;
    if (!rate) {
      rate = await this.accountingService.getExchangeRate(currency, 'EUR', dto.date);
    }

    const amountEur = Number((dto.amount * rate).toFixed(2));

    const payment = this.paymentRepo.create({
      invoiceId: dto.invoiceId || null,
      date: new Date(dto.date),
      amount: dto.amount,
      currency,
      exchangeRate: rate,
      amountEur,
      method: dto.method,
      reference: dto.reference,
      notes: dto.notes,
      description: dto.description,
      paidFromAccountId: dto.paidFromAccountId,
      categoryAccountId: dto.categoryAccountId,
      poId: dto.poId || null,
      attachment: dto.attachment || null,
    });

    const savedPayment = await this.paymentRepo.save(payment);

    // If there is an invoice, update its status
    if (invoice) {
      // Calculate total paid so far for this invoice
      const payments = await this.paymentRepo.find({ where: { invoiceId: invoice.id } });
      
      let totalPaidInInvoiceCurrency = 0;
      for (const p of payments) {
        if (p.currency.toUpperCase() === invoice.currency.toUpperCase()) {
          totalPaidInInvoiceCurrency += p.amount;
        } else {
          // Convert payment amount to invoice currency
          const pToEurRate = p.exchangeRate; // exchange rate from payment currency to EUR
          const eurToInvRate = await this.accountingService.getExchangeRate('EUR', invoice.currency, p.date);
          const amtInv = p.amount * pToEurRate * eurToInvRate;
          totalPaidInInvoiceCurrency += amtInv;
        }
      }

      totalPaidInInvoiceCurrency = Number(totalPaidInInvoiceCurrency.toFixed(2));

      // Update status
      let newStatus = InvoiceStatus.SENT; // fallback
      if (totalPaidInInvoiceCurrency >= invoice.total) {
        newStatus = InvoiceStatus.PAID;
      } else if (totalPaidInInvoiceCurrency > 0) {
        newStatus = 'partially_paid' as any;
      }

      await this.invoicesService.update(invoice.id, { status: newStatus });
    }

    // Generate payment journal entry
    await this.generatePaymentJournalEntry(savedPayment);

    return savedPayment;
  }

  async findAll(): Promise<Payment[]> {
    return this.paymentRepo.find({ relations: { invoice: true } });
  }

  async findOne(id: number): Promise<Payment> {
    const payment = await this.paymentRepo.findOne({
      where: { id },
      relations: { invoice: true },
    });
    if (!payment) {
      throw new NotFoundException(`Payment with ID ${id} not found`);
    }
    return payment;
  }

  async remove(id: number): Promise<void> {
    const payment = await this.findOne(id);
    const invoiceId = payment.invoiceId;
    
    // Delete payment
    await this.paymentRepo.remove(payment);

    // Delete associated Journal Entry
    const ref = payment.reference || `PAY-${payment.id}`;
    await this.accountingService.deleteJournalEntryByReference(ref);

    // If payment was linked to an invoice, re-calculate the status of that invoice
    if (invoiceId) {
      const invoice = await this.invoicesService.findOne(invoiceId);
      if (invoice) {
        const remainingPayments = await this.paymentRepo.find({ where: { invoiceId } });
        let totalPaidInInvoiceCurrency = 0;
        for (const p of remainingPayments) {
          if (p.currency.toUpperCase() === invoice.currency.toUpperCase()) {
            totalPaidInInvoiceCurrency += p.amount;
          } else {
            const pToEurRate = p.exchangeRate;
            const eurToInvRate = await this.accountingService.getExchangeRate('EUR', invoice.currency, p.date);
            totalPaidInInvoiceCurrency += p.amount * pToEurRate * eurToInvRate;
          }
        }
        totalPaidInInvoiceCurrency = Number(totalPaidInInvoiceCurrency.toFixed(2));

        let newStatus = InvoiceStatus.SENT;
        if (totalPaidInInvoiceCurrency >= invoice.total) {
          newStatus = InvoiceStatus.PAID;
        } else if (totalPaidInInvoiceCurrency > 0) {
          newStatus = 'partially_paid' as any;
        }
        await this.invoicesService.update(invoice.id, { status: newStatus });
      }
    }
  }

  private async generatePaymentJournalEntry(payment: Payment): Promise<void> {
    if (!payment.categoryAccountId || !payment.paidFromAccountId) {
      throw new BadRequestException(
        'Payment must have both a Category account and a Paid From account to generate a journal entry.',
      );
    }

    const linesDto: any[] = [];
    const dateStr = new Date(payment.date).toISOString().split('T')[0];

    // Debit Category account
    linesDto.push({
      accountId: payment.categoryAccountId,
      debit: payment.amount,
      currency: payment.currency,
      exchangeRate: payment.exchangeRate,
    });

    // Credit Paid From account
    linesDto.push({
      accountId: payment.paidFromAccountId,
      credit: payment.amount,
      currency: payment.currency,
      exchangeRate: payment.exchangeRate,
    });

    await this.accountingService.createJournalEntry({
      date: dateStr,
      description: payment.description || `Payment record Ref: ${payment.reference || 'N/A'}`,
      reference: payment.reference || `PAY-${payment.id}`,
      type: JournalEntryType.PAYMENT,
      invoiceId: payment.invoiceId || undefined,
      poId: payment.poId || undefined,
      attachment: payment.attachment || undefined,
      lines: linesDto,
    });
  }
}
