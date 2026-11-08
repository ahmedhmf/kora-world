import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeliveryNote } from './delivery-note.entity';
import { Account } from '../accounts/entities/account.entity';
import { Product } from '../products/entities/product.entity';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class DeliveryNotesService {
  constructor(
    @InjectRepository(DeliveryNote) private readonly notes: Repository<DeliveryNote>,
    @InjectRepository(Account) private readonly accounts: Repository<Account>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
  ) {}

  list(accountId: number) {
    return this.notes.find({ where: { accountId }, order: { id: 'DESC' } });
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
      accountId, noteNumber: 'PENDING', deliveryDate: dto.deliveryDate,
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
