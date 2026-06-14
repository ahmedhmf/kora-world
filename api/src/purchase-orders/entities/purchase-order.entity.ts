import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Supplier } from '../../suppliers/entities/supplier.entity';
import { PurchaseOrderLineItem } from './purchase-order-line-item.entity';

export enum POStatus {
  DRAFT = 'draft',
  SENT = 'sent',
  CONFIRMED = 'confirmed',
  SHIPPED = 'shipped',
  RECEIVED = 'received',
  CANCELLED = 'cancelled',
}

@Entity('purchase_orders')
export class PurchaseOrder {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'po_number', length: 50, unique: true })
  poNumber: string;

  @Column({ name: 'supplier_id' })
  supplierId: number;

  @Column({ name: 'order_date', type: 'date' })
  orderDate: Date;

  @Column({ name: 'expected_delivery', type: 'date', nullable: true })
  expectedDelivery: Date | null;

  @Column({
    type: 'enum',
    enum: POStatus,
    default: POStatus.DRAFT,
  })
  status: POStatus;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({
    name: 'total_value',
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  totalValue: number;

  @Column({ length: 10, nullable: true })
  currency: string;

  @Column({ name: 'shipping_cost', type: 'numeric', precision: 12, scale: 2, default: 0 })
  shippingCost: number;

  @Column({ length: 100, nullable: true })
  carrier?: string;

  @Column({ name: 'tracking_number', length: 100, nullable: true })
  trackingNumber?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Supplier, (supplier) => supplier.purchaseOrders)
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  @OneToMany(() => PurchaseOrderLineItem, (item) => item.purchaseOrder, {
    cascade: true,
  })
  lineItems: PurchaseOrderLineItem[];
}
