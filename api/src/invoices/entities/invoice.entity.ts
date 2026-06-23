import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Supplier } from '../../suppliers/entities/supplier.entity';
import { PurchaseOrder } from '../../purchase-orders/entities/purchase-order.entity';
import { InvoiceLine } from './invoice-line.entity';

export enum InvoiceType {
  INCOMING = 'incoming',
  OUTGOING = 'outgoing',
}

export enum InvoiceStatus {
  DRAFT = 'draft',
  SENT = 'sent',
  PAID = 'paid',
  OVERDUE = 'overdue',
  CANCELLED = 'cancelled',
}

@Entity('invoices')
export class Invoice {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100, unique: true })
  number: string;

  @Column({
    type: 'varchar',
    length: 50,
  })
  type: InvoiceType;

  @Column({ type: 'integer', name: 'supplier_id', nullable: true })
  supplierId?: number | null;

  @Column({
    type: 'varchar',
    name: 'customer_name',
    length: 150,
    nullable: true,
  })
  customerName?: string | null;

  @Column({ type: 'date' })
  date: Date | string;

  @Column({ name: 'due_date', type: 'date' })
  dueDate: Date | string;

  @Column({
    type: 'varchar',
    length: 50,
    default: InvoiceStatus.DRAFT,
  })
  status: InvoiceStatus;

  @Column({ length: 10 })
  currency: string;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0.0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value) || 0,
    },
  })
  subtotal: number;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0.0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value) || 0,
    },
  })
  tax: number;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0.0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value) || 0,
    },
  })
  total: number;

  @Column({ type: 'integer', name: 'po_id', nullable: true })
  poId?: number | null;

  @ManyToOne(() => Supplier, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'supplier_id' })
  supplier?: Supplier | null;

  @ManyToOne(() => PurchaseOrder, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'po_id' })
  purchaseOrder?: PurchaseOrder | null;

  @OneToMany(() => InvoiceLine, (line) => line.invoice, { cascade: true })
  lines: InvoiceLine[];
}
