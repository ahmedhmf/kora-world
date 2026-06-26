import { Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account } from './entities/account.entity';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

import { ProductsService } from '../products/products.service';
import { PurchaseOrdersService } from '../purchase-orders/purchase-orders.service';

@Injectable()
export class AccountsService {
  constructor(
    @InjectRepository(Account)
    private readonly accountRepo: Repository<Account>,
    private readonly productsService: ProductsService,
    @Inject(forwardRef(() => PurchaseOrdersService))
    private readonly purchaseOrdersService: PurchaseOrdersService,
  ) {}

  async findAll(): Promise<Account[]> {
    return this.accountRepo.find({
      relations: { assignedSalesRep: true },
      order: { companyName: 'ASC' },
    });
  }

  async findOne(id: number): Promise<Account> {
    const account = await this.accountRepo.findOne({
      where: { id },
      relations: { assignedSalesRep: true },
    });
    if (!account) throw new NotFoundException(`Account #${id} not found`);
    return account;
  }

  async generateNextAccountNumber(): Promise<string> {
    const lastAccount = await this.accountRepo.findOne({
      where: {},
      order: { id: 'DESC' },
    });

    let nextCounter = 1;
    if (lastAccount && lastAccount.accountNumber) {
      const parts = lastAccount.accountNumber.split('-');
      if (parts.length === 2) {
        const num = parseInt(parts[1], 10);
        if (!isNaN(num)) {
          nextCounter = num + 1;
        }
      }
    }

    return `ACC-${String(nextCounter).padStart(4, '0')}`;
  }

  async create(dto: CreateAccountDto): Promise<Account> {
    const accountNumber = await this.generateNextAccountNumber();
    const account = this.accountRepo.create({
      ...dto,
      accountNumber,
    });
    return this.accountRepo.save(account);
  }

  async update(id: number, dto: UpdateAccountDto): Promise<Account> {
    const account = await this.findOne(id);
    Object.assign(account, dto);
    return this.accountRepo.save(account);
  }

  async remove(id: number): Promise<void> {
    const account = await this.findOne(id);
    await this.accountRepo.remove(account);
  }

  async updateForecasts(id: number, forecasts: any[]): Promise<Account> {
    const account = await this.findOne(id);
    account.forecasts = forecasts;
    return this.accountRepo.save(account);
  }

  async createPOsFromForecast(id: number, forecastId: string, customItems?: Array<{ productId: number; quantity: number }>): Promise<{ success: boolean; poIds: number[] }> {
    const account = await this.findOne(id);
    if (!account.forecasts) {
      throw new NotFoundException('No forecasts found on this account');
    }

    const forecast = account.forecasts.find((f) => String(f.id) === String(forecastId));
    if (!forecast) {
      throw new NotFoundException(`Forecast with ID ${forecastId} not found`);
    }

    // Use custom selected items with custom amounts if provided, otherwise default to all forecast items
    const itemsToProcess = customItems && customItems.length > 0 ? customItems : forecast.items;

    // Group items by supplierId
    const supplierGroups = new Map<number, Array<{ productId: number; quantity: number }>>();

    for (const item of itemsToProcess) {
      if (item.quantity <= 0) continue; // Skip zero/negative custom quantities
      const product = await this.productsService.findOne(item.productId);
      if (!product) {
        throw new NotFoundException(`Product #${item.productId} not found`);
      }
      
      const supplierId = product.supplierId;
      if (!supplierGroups.has(supplierId)) {
        supplierGroups.set(supplierId, []);
      }
      supplierGroups.get(supplierId)!.push({
        productId: item.productId,
        quantity: item.quantity,
      });
    }

    const poIds: number[] = [];
    for (const [supplierId, lineItems] of supplierGroups.entries()) {
      if (lineItems.length === 0) continue;
      const createdPo = await this.purchaseOrdersService.create({
        supplierId,
        orderDate: new Date().toISOString(),
        notes: `Auto-generated from B2B Client Forecast (Year: ${forecast.year}) for Account: ${account.companyName}`,
        lineItems,
      });
      poIds.push(createdPo.id);
    }

    if (poIds.length > 0) {
      // Accumulate ordered quantities on the corresponding original forecast items
      for (const item of itemsToProcess) {
        if (item.quantity <= 0) continue;
        const origItem = forecast.items.find((i) => i.productId === item.productId);
        if (origItem) {
          origItem.orderedQuantity = (origItem.orderedQuantity || 0) + item.quantity;
        }
      }

      // Check if all forecast items are fully ordered
      const allFulfilled = forecast.items.every((i) => (i.orderedQuantity || 0) >= i.quantity);
      if (allFulfilled) {
        forecast.status = 'po_created';
      }
      
      await this.accountRepo.save(account);
    }

    return { success: true, poIds };
  }

  async rollbackForecastQuantities(companyName: string, year: number, lineItems: Array<{ productId: number; quantity: number }>): Promise<void> {
    const account = await this.accountRepo.findOne({ where: { companyName } });
    if (!account || !account.forecasts) return;

    const forecast = account.forecasts.find((f) => f.year === year);
    if (!forecast) return;

    for (const item of lineItems) {
      const origItem = forecast.items.find((i) => i.productId === item.productId);
      if (origItem) {
        origItem.orderedQuantity = Math.max(0, (origItem.orderedQuantity || 0) - item.quantity);
      }
    }

    // Since we subtracted quantity, it's no longer fully PO generated, so set status back to 'draft'
    forecast.status = 'draft';
    await this.accountRepo.save(account);
  }
}
