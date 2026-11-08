import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { WeeklySalesReport } from './weekly-sales-report.entity';
import { DeliveryNote } from './delivery-note.entity';
import { Account } from '../accounts/entities/account.entity';
import { Product } from '../products/entities/product.entity';
import * as fs from 'fs';
import { randomUUID } from 'crypto';
import * as path from 'path';

@Injectable()
export class DeliveryNotesService {
  constructor(
    @InjectRepository(DeliveryNote) private readonly notes: Repository<DeliveryNote>,
    @InjectRepository(Account) private readonly accounts: Repository<Account>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(WeeklySalesReport) private readonly sales: Repository<WeeklySalesReport>,
    private readonly dataSource: DataSource,
  ) {}

  list(accountId: number) {
    return this.notes.find({ where: { accountId }, order: { id: 'DESC' } });
  }

  async inventory(accountId: number) {
    const account = await this.accounts.findOneBy({ id: accountId });
    if (!account) throw new NotFoundException('Account not found');
    // Signed notes are the immutable source of inventory receipts. Re-uploading a
    // signed document cannot add stock a second time.
    const signed = await this.notes.createQueryBuilder('note')
      .where('note.accountId = :accountId', { accountId })
      .andWhere('note.signedFilePath IS NOT NULL')
      .orderBy('note.id', 'ASC')
      .getMany();
    const inventory = new Map<number, {
      productId: number; articleNumber: string; productName: string;
      quantity: number; deliveries: Array<{ noteId: number; noteNumber: string; deliveryDate: string; quantity: number }>;
    }>();
    for (const note of signed) {
      for (const item of note.items) {
        let row = inventory.get(item.productId);
        if (!row) {
          row = { productId: item.productId, articleNumber: item.articleNumber,
            productName: item.productName, quantity: 0, deliveries: [] };
          inventory.set(item.productId, row);
        }
        row.quantity += item.quantity;
        row.deliveries.push({ noteId: note.id, noteNumber: note.noteNumber,
          deliveryDate: note.deliveryDate, quantity: item.quantity });
      }
    }
    const approved = await this.sales.find({ where: { accountId, status: 'approved' } });
    for (const report of approved) {
      for (const item of report.items) {
        const row = inventory.get(item.productId);
        if (row) row.quantity -= item.quantity;
      }
    }
    return [...inventory.values()].sort((a, b) => a.articleNumber.localeCompare(b.articleNumber));
  }

  async listSales(accountId: number) {
    if (!await this.accounts.exist({ where: { id: accountId } })) throw new NotFoundException('Account not found');
    return this.sales.find({ where: { accountId }, order: { id: 'DESC' } });
  }

  async createSales(accountId: number, dto: {
    weekStart: string; weekEnd: string; filePath: string; fileName: string;
    remarks?: string; items: Array<{ productId: number; quantity: number }>;
  }) {
    if (!await this.accounts.exist({ where: { id: accountId } })) throw new NotFoundException('Account not found');
    const validDate = (v: string) => /^\\d{4}-\\d{2}-\\d{2}$/.test(v || '') &&
      !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
    if (!validDate(dto.weekStart) || !validDate(dto.weekEnd) || dto.weekEnd < dto.weekStart) {
      throw new BadRequestException('Enter a valid reporting period');
    }
    if (!/^\\d+-\\d+\\.pdf$/i.test(dto.filePath || '') || !fs.existsSync(path.join(process.cwd(), 'uploads', dto.filePath))) {
      throw new BadRequestException('Upload the weekly sales PDF first');
    }
    if (!dto.fileName || dto.fileName.length > 255) throw new BadRequestException('Invalid PDF file name');
    if (!Array.isArray(dto.items) || !dto.items.length || dto.items.length > 100) {
      throw new BadRequestException('Enter between 1 and 100 sold product lines');
    }
    const seen = new Set<number>();
    const items: WeeklySalesReport['items'] = [];
    for (const item of dto.items) {
      if (!Number.isInteger(item.productId) || !Number.isInteger(item.quantity) ||
        item.quantity < 1 || item.quantity > 100000 || seen.has(item.productId)) {
        throw new BadRequestException('Products must be unique with positive whole-number quantities');
      }
      seen.add(item.productId);
      const product = await this.products.findOneBy({ id: item.productId });
      if (!product) throw new BadRequestException('Unknown product');
      items.push({ productId: product.id, articleNumber: product.articleNumber, productName: product.name, quantity: item.quantity });
    }
    return this.sales.save(this.sales.create({
      accountId, weekStart: dto.weekStart, weekEnd: dto.weekEnd,
      filePath: dto.filePath, fileName: dto.fileName, remarks: dto.remarks?.slice(0, 2000),
      status: 'draft', items,
    }));
  }

  async approveSales(id: number) {
    return this.dataSource.transaction(async manager => {
      const report = await manager.findOne(WeeklySalesReport, { where: { id } });
      if (!report) throw new NotFoundException('Weekly sales report not found');
      // Serialize approvals for this account, preventing two concurrent reports
      // from independently passing the same remaining-stock check.
      await manager.findOne(Account, { where: { id: report.accountId }, lock: { mode: 'pessimistic_write' } });
      const current = await manager.findOne(WeeklySalesReport, { where: { id } });
      if (!current || current.status !== 'draft') throw new BadRequestException('Report already approved');
      const notes = await manager.createQueryBuilder(DeliveryNote, 'note')
        .where('note.accountId = :accountId', { accountId: report.accountId })
        .andWhere('note.signedFilePath IS NOT NULL').getMany();
      const remaining = new Map<number, number>();
      for (const note of notes) for (const item of note.items) {
        remaining.set(item.productId, (remaining.get(item.productId) || 0) + item.quantity);
      }
      const approved = await manager.find(WeeklySalesReport, { where: { accountId: report.accountId, status: 'approved' } });
      for (const prior of approved) for (const item of prior.items) {
        remaining.set(item.productId, (remaining.get(item.productId) || 0) - item.quantity);
      }
      for (const item of current.items) {
        if (item.quantity > (remaining.get(item.productId) || 0)) {
          throw new BadRequestException('Insufficient remaining inventory for ' + item.articleNumber);
        }
      }
      current.status = 'approved';
      current.approvedAt = new Date();
      return manager.save(WeeklySalesReport, current);
    });
  }

  async get(id: number) {
    const note = await this.notes.findOneBy({ id });
    if (!note) throw new NotFoundException('Delivery note not found');
    return note;
  }

  async create(accountId: number, dto: { deliveryDate: string; remarks?: string; items: Array<{ productId: number; quantity: number }> }) {
    const account = await this.accounts.findOneBy({ id: accountId });
    if (!account) throw new NotFoundException('Account not found');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dto.deliveryDate || '') || !Number.isFinite(Date.parse(dto.deliveryDate))) {
      throw new BadRequestException('Valid delivery date is required');
    }
    if (!Array.isArray(dto.items) || dto.items.length === 0 || dto.items.length > 100) {
      throw new BadRequestException('Provide between 1 and 100 delivery items');
    }
    const ids = new Set<number>();
    const items: DeliveryNote['items'] = [];
    for (const item of dto.items) {
      if (!Number.isInteger(item.productId) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 100000 || ids.has(item.productId)) {
        throw new BadRequestException('Each product must be unique and have a positive whole-number quantity');
      }
      ids.add(item.productId);
      const product = await this.products.findOneBy({ id: item.productId });
      if (!product) throw new BadRequestException('One of the selected products does not exist');
      items.push({ productId: product.id, articleNumber: product.articleNumber, productName: product.name, quantity: item.quantity });
    }
    // A database sequence-backed ID ensures uniqueness even when users create notes concurrently.
    const note = await this.notes.save(this.notes.create({
      accountId, noteNumber: 'TMP-' + randomUUID(), deliveryDate: dto.deliveryDate,
      customerName: account.companyName,
      deliveryAddress: [account.shippingStreet, account.shippingZip, account.shippingCity, account.shippingCountry].filter(Boolean).join(', '),
      paymentModel: account.paymentModel, items, remarks: dto.remarks?.slice(0, 2000),
    }));
    note.noteNumber = 'DN-' + String(note.id).padStart(6, '0');
    return this.notes.save(note);
  }

  async attachSignedCopy(id: number, dto: { path: string; name: string }) {
    const note = await this.get(id);
    if (!dto || !/^\d+-\d+\.(pdf|png|jpg|jpeg)$/i.test(dto.path || '')) {
      throw new BadRequestException('Upload a PDF, PNG, or JPEG signed copy first');
    }
    const file = path.join(process.cwd(), 'uploads', dto.path);
    if (!fs.existsSync(file)) throw new BadRequestException('Uploaded file not found');
    if (dto.name?.length > 255) throw new BadRequestException('File name is too long');
    note.signedFilePath = dto.path;
    note.signedFileName = dto.name || dto.path;
    return this.notes.save(note);
  }
}
