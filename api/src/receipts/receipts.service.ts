import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Receipt, ReceiptStatus } from './entities/receipt.entity';
import { ReceiptLineItem } from './entities/receipt-line-item.entity';
import { CreateReceiptDto } from './dto/create-receipt.dto';
import { UpdateReceiptDto } from './dto/update-receipt.dto';
import { AccountsService } from '../accounts/accounts.service';

@Injectable()
export class ReceiptsService {
  constructor(
    @InjectRepository(Receipt)
    private readonly receiptRepo: Repository<Receipt>,
    @InjectRepository(ReceiptLineItem)
    private readonly lineItemRepo: Repository<ReceiptLineItem>,
    private readonly accountsService: AccountsService,
  ) {}

  async findAll(): Promise<Receipt[]> {
    return this.receiptRepo.find({
      relations: { account: true },
      order: { issueDate: 'DESC', createdAt: 'DESC' },
    });
  }

  async findByAccount(accountId: number): Promise<Receipt[]> {
    return this.receiptRepo.find({
      where: { accountId },
      relations: { account: true },
      order: { issueDate: 'DESC' },
    });
  }

  async findOne(id: number): Promise<Receipt> {
    const receipt = await this.receiptRepo.findOne({
      where: { id },
      relations: {
        account: true,
        lineItems: { product: true },
      },
    });
    if (!receipt) throw new NotFoundException(`Receipt #${id} not found`);
    return receipt;
  }

  async create(dto: CreateReceiptDto): Promise<Receipt> {
    // 1. Validate account exists and get defaults
    const account = await this.accountsService.findOne(dto.accountId);

    // 2. Generate unique receipt number
    let receiptNumber = '';
    let exists = true;
    while (exists) {
      const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      receiptNumber = `RCP-${todayStr}-${randomSuffix}`;
      const existing = await this.receiptRepo.findOneBy({ receiptNumber });
      if (!existing) exists = false;
    }

    // 3. Build and compute line items
    const vatRate = dto.vatRate ?? 0;
    let subtotal = 0;
    let totalDiscountAmount = 0;

    const lineItemsData: ReceiptLineItem[] = dto.lineItems.map((item) => {
      const discountPct = item.discountPct ?? 0;
      const grossLine = item.unitPrice * item.quantity;
      const discountAmt = grossLine * (discountPct / 100);
      const lineTotal = grossLine - discountAmt;

      subtotal += grossLine;
      totalDiscountAmount += discountAmt;

      return this.lineItemRepo.create({
        productId: item.productId ?? null,
        articleNumber: item.articleNumber,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountPct,
        lineTotal,
      });
    });

    const netSubtotal = subtotal - totalDiscountAmount;
    const taxAmount = netSubtotal * (vatRate / 100);
    const totalAmount = netSubtotal + taxAmount;

    // 4. Create receipt
    const receipt = this.receiptRepo.create({
      receiptNumber,
      accountId: dto.accountId,
      status: ReceiptStatus.DRAFT,
      issueDate: new Date(dto.issueDate),
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      currency: dto.currency ?? account.defaultCurrency ?? 'USD',
      paymentTerms: dto.paymentTerms ?? account.paymentTerms ?? null,
      vatRate,
      subtotal,
      discountAmount: totalDiscountAmount,
      taxAmount,
      totalAmount,
      notes: dto.notes ?? null,
      lineItems: lineItemsData,
    });

    return this.receiptRepo.save(receipt);
  }

  async update(id: number, dto: UpdateReceiptDto): Promise<Receipt> {
    const receipt = await this.findOne(id);

    if (dto.status !== undefined) receipt.status = dto.status;
    if (dto.dueDate !== undefined)
      receipt.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    if (dto.paymentTerms !== undefined) receipt.paymentTerms = dto.paymentTerms;
    if (dto.notes !== undefined) receipt.notes = dto.notes;

    return this.receiptRepo.save(receipt);
  }

  async remove(id: number): Promise<void> {
    const receipt = await this.findOne(id);
    await this.receiptRepo.remove(receipt);
  }
}
