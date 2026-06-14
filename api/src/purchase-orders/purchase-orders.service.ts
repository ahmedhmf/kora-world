import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PurchaseOrder, POStatus } from './entities/purchase-order.entity';
import { PurchaseOrderLineItem } from './entities/purchase-order-line-item.entity';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { SuppliersService } from '../suppliers/suppliers.service';
import { ProductsService } from '../products/products.service';

@Injectable()
export class PurchaseOrdersService {
  constructor(
    @InjectRepository(PurchaseOrder)
    private readonly poRepo: Repository<PurchaseOrder>,
    @InjectRepository(PurchaseOrderLineItem)
    private readonly lineItemRepo: Repository<PurchaseOrderLineItem>,
    private readonly suppliersService: SuppliersService,
    private readonly productsService: ProductsService,
  ) {}

  async findAll(): Promise<PurchaseOrder[]> {
    return this.poRepo.find({
      relations: { supplier: true },
      order: { orderDate: 'DESC', createdAt: 'DESC' },
    });
  }

  async findOne(id: number): Promise<PurchaseOrder> {
    const po = await this.poRepo.findOne({
      where: { id },
      relations: {
        supplier: true,
        lineItems: {
          product: true,
        },
      },
    });
    if (!po) throw new NotFoundException(`Purchase Order #${id} not found`);
    return po;
  }

  async create(dto: CreatePurchaseOrderDto): Promise<PurchaseOrder> {
    // 1. Validate Supplier exists
    const supplier = await this.suppliersService.findOne(dto.supplierId);

    // 2. Generate unique poNumber
    let poNumber = '';
    let exists = true;
    while (exists) {
      const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      poNumber = `PO-${todayStr}-${randomSuffix}`;
      const existing = await this.poRepo.findOneBy({ poNumber });
      if (!existing) {
        exists = false;
      }
    }

    // 3. Resolve and snapshot line items
    let itemsSubtotal = 0;
    let totalWeight = 0;
    const lineItemsData: PurchaseOrderLineItem[] = [];

    for (const item of dto.lineItems) {
      const product = await this.productsService.findOne(item.productId);
      
      // Ensure product belongs to supplier
      if (product.supplierId !== dto.supplierId) {
        throw new BadRequestException(
          `Product #${product.id} (${product.name}) does not belong to Supplier #${dto.supplierId} (${supplier.name})`
        );
      }

      const lineTotal = Number(product.unitPrice) * item.quantity;
      itemsSubtotal += lineTotal;
      totalWeight += Number(product.weightKg || 0) * item.quantity;

      const lineItem = this.lineItemRepo.create({
        productId: product.id,
        articleNumber: product.articleNumber,
        description: product.name,
        quantity: item.quantity,
        unitPrice: product.unitPrice,
        lineTotal: lineTotal,
      });

      lineItemsData.push(lineItem);
    }

    // Calculate shipping cost based on weight and supplier shipping rate
    const shippingRate = Number(supplier.shippingRatePerKg || 0);
    const shippingCost = totalWeight * shippingRate;
    const totalValue = itemsSubtotal + shippingCost;

    // 4. Calculate expectedDelivery based on leadTimeDays if not provided
    let expectedDelivery: Date | null = null;
    if (dto.expectedDelivery) {
      expectedDelivery = new Date(dto.expectedDelivery);
    } else if (supplier.leadTimeDays) {
      const orderDate = new Date(dto.orderDate);
      expectedDelivery = new Date(orderDate.getTime() + supplier.leadTimeDays * 24 * 60 * 60 * 1000);
    }

    // 5. Create and Save Purchase Order
    const po = this.poRepo.create({
      poNumber,
      supplierId: dto.supplierId,
      orderDate: new Date(dto.orderDate),
      expectedDelivery,
      status: dto.status || POStatus.DRAFT,
      notes: dto.notes,
      shippingCost,
      totalValue,
      currency: supplier.currency || 'USD',
      lineItems: lineItemsData,
      carrier: dto.carrier,
      trackingNumber: dto.trackingNumber,
    });

    return this.poRepo.save(po);
  }

  async update(id: number, dto: UpdatePurchaseOrderDto): Promise<PurchaseOrder> {
    const po = await this.findOne(id);

    // If updating supplier or line items, we restrict this in update (business rule)
    // To update line items, users should cancel and make a new PO, or we only update basic properties
    if (dto.supplierId && dto.supplierId !== po.supplierId) {
      throw new BadRequestException('Cannot change supplier of an existing Purchase Order');
    }

    if (dto.lineItems) {
      // For simplicity, we only allow modifying status/dates/notes.
      // Re-calculating nested line items on update requires deleting old line items, but for now we block it.
      throw new BadRequestException('Line items cannot be modified after creation. Please recreate the order if changes are needed.');
    }

    if (dto.status) po.status = dto.status;
    if (dto.expectedDelivery !== undefined) po.expectedDelivery = dto.expectedDelivery ? new Date(dto.expectedDelivery) : null;
    if (dto.notes !== undefined) po.notes = dto.notes;
    if (dto.carrier !== undefined) po.carrier = dto.carrier;
    if (dto.trackingNumber !== undefined) po.trackingNumber = dto.trackingNumber;

    return this.poRepo.save(po);
  }

  async remove(id: number): Promise<void> {
    const po = await this.findOne(id);
    await this.poRepo.remove(po);
  }
}
