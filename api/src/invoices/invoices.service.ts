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

  async create(dto: CreateInvoiceDto): Promise<Invoice> {
    const existing = await this.invoiceRepo.findOne({ where: { number: dto.number } });
    if (existing) {
      throw new BadRequestException(`Invoice with number ${dto.number} already exists`);
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
      number: dto.number,
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
    if (
      (savedInvoice.status === InvoiceStatus.SENT || savedInvoice.status === InvoiceStatus.PAID) &&
      previousStatus === InvoiceStatus.DRAFT
    ) {
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
    // Check if journal entry already exists for this invoice
    const allEntries = await this.accountingService.findAllJournalEntries();
    const existing = allEntries.find(
      entry => entry.invoiceId === invoice.id && entry.type === JournalEntryType.INVOICE
    );
    if (existing) {
      return; // Already generated
    }

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
      // Debit COGS (Expense) for subtotal
      const cogsAccountId = findAccountByCode('5100');
      linesDto.push({
        accountId: cogsAccountId,
        debit: invoice.subtotal,
        currency: invoice.currency,
      });

      // Debit VAT Payable (Asset/Liability offset) for tax
      if (invoice.tax > 0) {
        const vatAccountId = findAccountByCode('2200');
        linesDto.push({
          accountId: vatAccountId,
          debit: invoice.tax,
          currency: invoice.currency,
        });
      }

      // Credit Accounts Payable for total
      const apAccountId = findAccountByCode('2100');
      linesDto.push({
        accountId: apAccountId,
        credit: invoice.total,
        currency: invoice.currency,
      });
    } else {
      // Customer Invoice
      // Debit Accounts Receivable for total
      const arAccountId = findAccountByCode('1200');
      linesDto.push({
        accountId: arAccountId,
        debit: invoice.total,
        currency: invoice.currency,
      });

      // Credit Product Sales (Revenue) for subtotal
      const salesAccountId = findAccountByCode('4100');
      linesDto.push({
        accountId: salesAccountId,
        credit: invoice.subtotal,
        currency: invoice.currency,
      });

      // Credit VAT Payable for tax
      if (invoice.tax > 0) {
        const vatAccountId = findAccountByCode('2200');
        linesDto.push({
          accountId: vatAccountId,
          credit: invoice.tax,
          currency: invoice.currency,
        });
      }
    }

    await this.accountingService.createJournalEntry({
      date: dateStr,
      description: `Auto-generated from Invoice #${invoice.number}`,
      reference: invoice.number,
      type: JournalEntryType.INVOICE,
      invoiceId: invoice.id,
      poId: invoice.poId || undefined,
      lines: linesDto,
    });
  }
}
