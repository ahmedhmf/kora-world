import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { PurchaseOrder } from './purchase-order.entity';
import { Product } from '../../products/entities/product.entity';

@Entity('po_line_items')
export class PurchaseOrderLineItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'po_id' })
  poId: number;

  @Column({ name: 'product_id', nullable: true })
  productId: number;

  // Snapshotted fields — frozen at PO creation time
  @Column({ name: 'article_number', length: 100 })
  articleNumber: string;

  @Column({ length: 255 })
  description: string;

  @Column()
  quantity: number;

  @Column({ name: 'unit_price', type: 'numeric', precision: 10, scale: 2 })
  unitPrice: number;

  @Column({ name: 'line_total', type: 'numeric', precision: 12, scale: 2 })
  lineTotal: number;

  @ManyToOne(() => PurchaseOrder, (po) => po.lineItems, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'po_id' })
  purchaseOrder: PurchaseOrder;

  @ManyToOne(() => Product, { nullable: true })
  @JoinColumn({ name: 'product_id' })
  product: Product;
}
