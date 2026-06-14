import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { Product } from 'src/products/entities/product.entity';
import { PurchaseOrder } from 'src/purchase-orders/entities/purchase-order.entity';

@Entity('suppliers')
export class Supplier {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 100, nullable: true })
  country: string;

  @Column({ name: 'contact_name', length: 100, nullable: true })
  contactName: string;

  @Column({ name: 'contact_email', length: 150, nullable: true })
  contactEmail: string;

  @Column({ name: 'contact_phone', length: 50, nullable: true })
  contactPhone: string;

  @Column({ name: 'payment_terms', length: 100, nullable: true })
  paymentTerms: string;

  @Column({ name: 'lead_time_days', nullable: true })
  leadTimeDays: number;

  @Column({ length: 10, nullable: true })
  currency: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ name: 'shipping_rate_per_kg', type: 'numeric', precision: 10, scale: 2, default: 0 })
  shippingRatePerKg: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => Product, (product) => product.supplier)
  products: Product[];

  @OneToMany(() => PurchaseOrder, (po) => po.supplier)
  purchaseOrders: PurchaseOrder[];
}
