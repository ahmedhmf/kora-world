import { Injectable, BadRequestException, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice, InvoiceStatus, InvoiceType } from './entities/invoice.entity';
import { InvoiceLine } from './entities/invoice-line.entity';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { AccountingService } from '../accounting/accounting.service';
import { JournalEntryType } from '../accounting/entities/journal-entry.entity';

@Injectable()
export class InvoicesService {
  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(InvoiceLine)
    private readonly lineRepo: Repository<InvoiceLine>,
    @Inject(forwardRef(() => AccountingService))
    private readonly accountingService: AccountingService,
  ) {}

  async generateNextNumber(): Promise<{ number: string }> {
    const year = new Date().getFullYear();
    const prefix = `INV-${year}-`;

    // Find the highest existing number for this year
    const invoices = await this.invoiceRepo
      .createQueryBuilder('inv')
      .select('inv.number', 'number')
      .where('inv.number LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('inv.number', 'DESC')
      .limit(1)
      .getRawOne();

    let nextSeq = 1;
    if (invoices?.number) {
      const seq = parseInt(invoices.number.replace(prefix, ''), 10);
      if (!isNaN(seq)) nextSeq = seq + 1;
    }

    let padded = String(nextSeq).padStart(4, '0');
    let number = `${prefix}${padded}`;
    while (await this.invoiceRepo.findOne({ where: { number } })) {
      nextSeq++;
      padded = String(nextSeq).padStart(4, '0');
      number = `${prefix}${padded}`;
    }

    return { number };
  }

  async create(dto: CreateInvoiceDto): Promise<Invoice> {
    let invoiceNumber = dto.number;
    if (!invoiceNumber) {
      const generated = await this.generateNextNumber();
      invoiceNumber = generated.number;
    } else {
      const existing = await this.invoiceRepo.findOne({ where: { number: invoiceNumber } });
      if (existing) {
        throw new BadRequestException(`Invoice with number ${invoiceNumber} already exists`);
      }
    }

    let subtotal = 0;
    const lines = dto.lines.map(lineDto => {
      const lineTotal = Number((lineDto.quantity * lineDto.unitPrice).toFixed(2));
      subtotal += lineTotal;
      return this.lineRepo.create({
        description: lineDto.description,
        quantity: lineDto.quantity,
        unitPrice: lineDto.unitPrice,
        total: lineTotal,
      });
    });

    const tax = dto.tax || 0;
    const total = Number((subtotal + tax).toFixed(2));

    const invoice = this.invoiceRepo.create({
      number: invoiceNumber,
      type: dto.type,
      supplierId: dto.supplierId,
      customerName: dto.customerName,
      date: new Date(dto.date),
      dueDate: new Date(dto.dueDate),
      status: dto.status || InvoiceStatus.DRAFT,
      currency: dto.currency.toUpperCase(),
      subtotal,
      tax,
      total,
      poId: dto.poId,
      lines,
    });

    const savedInvoice = await this.invoiceRepo.save(invoice);

    // If invoice is created as SENT or PAID, generate the double-entry journal entry
    if (savedInvoice.status === InvoiceStatus.SENT || savedInvoice.status === InvoiceStatus.PAID) {
      await this.generateJournalEntry(savedInvoice);
    }

    return savedInvoice;
  }

  async update(id: number, dto: UpdateInvoiceDto): Promise<Invoice> {
    const invoice = await this.invoiceRepo.findOne({
      where: { id },
      relations: { lines: true },
    });
    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    }

    const previousStatus = invoice.status;

    if (dto.number && dto.number !== invoice.number) {
      const existing = await this.invoiceRepo.findOne({ where: { number: dto.number } });
      if (existing) {
        throw new BadRequestException(`Invoice with number ${dto.number} already exists`);
      }
      invoice.number = dto.number;
    }

    if (dto.lines) {
      // Re-create lines
      await this.lineRepo.delete({ invoiceId: invoice.id });
      let subtotal = 0;
      const lines = dto.lines.map(lineDto => {
        const lineTotal = Number((lineDto.quantity * lineDto.unitPrice).toFixed(2));
        subtotal += lineTotal;
        return this.lineRepo.create({
          description: lineDto.description,
          quantity: lineDto.quantity,
          unitPrice: lineDto.unitPrice,
          total: lineTotal,
        });
      });
      invoice.lines = lines;
      invoice.subtotal = subtotal;
      invoice.tax = dto.tax !== undefined ? dto.tax : invoice.tax;
      invoice.total = Number((invoice.subtotal + invoice.tax).toFixed(2));
    } else if (dto.tax !== undefined) {
      invoice.tax = dto.tax;
      invoice.total = Number((invoice.subtotal + invoice.tax).toFixed(2));
    }

    if (dto.type) invoice.type = dto.type;
    if (dto.supplierId !== undefined) invoice.supplierId = dto.supplierId;
    if (dto.customerName !== undefined) invoice.customerName = dto.customerName;
    if (dto.date) invoice.date = new Date(dto.date);
    if (dto.dueDate) invoice.dueDate = new Date(dto.dueDate);
    if (dto.status) invoice.status = dto.status;
    if (dto.currency) invoice.currency = dto.currency.toUpperCase();
    if (dto.poId !== undefined) invoice.poId = dto.poId;

    const savedInvoice = await this.invoiceRepo.save(invoice);

    // If status changed to SENT or PAID, check and generate journal entry
    if (savedInvoice.status === InvoiceStatus.SENT || savedInvoice.status === InvoiceStatus.PAID) {
      await this.generateJournalEntry(savedInvoice);
    }

    return savedInvoice;
  }

  async findAll(): Promise<Invoice[]> {
    return this.invoiceRepo.find({ relations: { lines: true, supplier: true, purchaseOrder: true } });
  }

  async findOne(id: number): Promise<Invoice> {
    const invoice = await this.invoiceRepo.findOne({
      where: { id },
      relations: { lines: true, supplier: true, purchaseOrder: true },
    });
    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    }
    return invoice;
  }

  async remove(id: number): Promise<void> {
    const invoice = await this.findOne(id);
    await this.invoiceRepo.remove(invoice);
  }

  // --- Double-Entry Posting ---
  private async generateJournalEntry(invoice: Invoice): Promise<void> {
    console.log(`[generateJournalEntry] Processing invoice ID: ${invoice.id}, Number: ${invoice.number}, Status: ${invoice.status}`);
    const allEntries = await this.accountingService.findAllJournalEntries();

    // 1. Ensure Step 1 (Invoice Booking: AR vs Revenue) is created
    const existingInvoiceEntry = allEntries.find(
      entry => entry.invoiceId === invoice.id && entry.type === JournalEntryType.INVOICE
    );
    console.log(`[generateJournalEntry] Step 1 existing: ${!!existingInvoiceEntry}`);

    if (!existingInvoiceEntry && (invoice.status === InvoiceStatus.SENT || invoice.status === InvoiceStatus.PAID)) {
      console.log(`[generateJournalEntry] Creating Step 1 entry...`);
      // Resolve accounts:
      const accounts = await this.accountingService.findAllAccounts();
      const findAccountByCode = (code: string) => {
        const acc = accounts.find(a => a.code === code);
        if (!acc) throw new NotFoundException(`Account with code ${code} not found. Please run seeding.`);
        return acc.id;
      };

      const linesDto: any[] = [];
      const dateStr = new Date(invoice.date).toISOString().split('T')[0];

      if (invoice.type === InvoiceType.INCOMING) {
        // Supplier Invoice
        const cogsAccountId = findAccountByCode('5100');
        linesDto.push({
          accountId: cogsAccountId,
          debit: invoice.subtotal,
          currency: invoice.currency,
        });

        if (invoice.tax > 0) {
          const vatAccountId = findAccountByCode('2200');
          linesDto.push({
            accountId: vatAccountId,
            debit: invoice.tax,
            currency: invoice.currency,
          });
        }

        const apAccountId = findAccountByCode('2100');
        linesDto.push({
          accountId: apAccountId,
          credit: invoice.total,
          currency: invoice.currency,
        });
      } else {
        // Customer Invoice
        const arAccountId = findAccountByCode('1200');
        linesDto.push({
          accountId: arAccountId,
          debit: invoice.total,
          currency: invoice.currency,
        });

        const salesAccountId = findAccountByCode('4100');
        linesDto.push({
          accountId: salesAccountId,
          credit: invoice.subtotal,
          currency: invoice.currency,
        });

        if (invoice.tax > 0) {
          const vatAccountId = findAccountByCode('2200');
          linesDto.push({
            accountId: vatAccountId,
            credit: invoice.tax,
            currency: invoice.currency,
          });
        }
      }

      console.log(`[generateJournalEntry] Submitting Step 1 journal entry DTO...`);
      await this.accountingService.createJournalEntry({
        date: dateStr,
        description: `Auto-generated from Invoice #${invoice.number}`,
        reference: invoice.number,
        type: JournalEntryType.INVOICE,
        invoiceId: invoice.id,
        poId: invoice.poId || undefined,
        lines: linesDto,
      });
      console.log(`[generateJournalEntry] Step 1 journal entry created successfully.`);
    }

    // 2. Ensure Step 2 (Payment Booking: Bank vs AR/AP) is created if PAID
    if (invoice.status === InvoiceStatus.PAID) {
      const existingPaymentEntry = allEntries.find(
        entry => entry.invoiceId === invoice.id && entry.reference === `${invoice.number}-PAY`
      );
      console.log(`[generateJournalEntry] Step 2 existing check: ${!!existingPaymentEntry}`);

      if (!existingPaymentEntry) {
        const accounts = await this.accountingService.findAllAccounts();
        const findAccountByCode = (code: string) => {
          const acc = accounts.find(a => a.code === code);
          if (!acc) throw new NotFoundException(`Account with code ${code} not found. Please run seeding.`);
          return acc.id;
        };

        const linesDto: any[] = [];
        const dateStr = new Date().toISOString().split('T')[0];

        // Determine bank account based on invoice currency
        let bankAccountCode = '1101'; // Default EUR Bank
        if (invoice.currency === 'EGP') bankAccountCode = '1102';
        else if (invoice.currency === 'USD') bankAccountCode = '1103';

        const bankAccountId = findAccountByCode(bankAccountCode);
        const arAccountId = findAccountByCode('1200');

        if (invoice.type === InvoiceType.INCOMING) {
          // Supplier invoice payment: Credit Bank, Debit Accounts Payable
          const apAccountId = findAccountByCode('2100');
          linesDto.push({
            accountId: apAccountId,
            debit: invoice.total,
            currency: invoice.currency,
          });
          linesDto.push({
            accountId: bankAccountId,
            credit: invoice.total,
            currency: invoice.currency,
          });
        } else {
          // Customer invoice payment: Debit Bank, Credit Accounts Receivable
          linesDto.push({
            accountId: bankAccountId,
            debit: invoice.total,
            currency: invoice.currency,
          });
          linesDto.push({
            accountId: arAccountId,
            credit: invoice.total,
            currency: invoice.currency,
          });
        }

        console.log(`[generateJournalEntry] Submitting Step 2 payment entry DTO...`);
        await this.accountingService.createJournalEntry({
          date: dateStr,
          description: `Auto-generated Payment for Invoice #${invoice.number}`,
          reference: `${invoice.number}-PAY`,
          type: JournalEntryType.PAYMENT,
          invoiceId: invoice.id,
          poId: invoice.poId || undefined,
          lines: linesDto,
        });
        console.log(`[generateJournalEntry] Step 2 payment entry created successfully.`);
      }
    }
  }
}
