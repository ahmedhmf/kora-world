import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Receipt } from './receipt.entity';
import { Product } from '../../products/entities/product.entity';

const numericTransformer = {
  to: (value: number) => value,
  from: (value: string) => parseFloat(value) || 0,
};

@Entity('receipt_line_items')
export class ReceiptLineItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'receipt_id' })
  receiptId: number;

  @Column({ name: 'product_id', nullable: true })
  productId: number | null;

  // Snapshotted at receipt creation — never changes even if product is updated
  @Column({ name: 'article_number', length: 100 })
  articleNumber: string;

  @Column({ length: 255 })
  description: string;

  @Column({ type: 'integer', default: 1 })
  quantity: number;

  @Column({
    name: 'unit_price',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: numericTransformer,
  })
  unitPrice: number;

  @Column({
    name: 'discount_pct',
    type: 'numeric',
    precision: 5,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  discountPct: number;

  @Column({
    name: 'line_total',
    type: 'numeric',
    precision: 14,
    scale: 2,
    transformer: numericTransformer,
  })
  lineTotal: number;

  @ManyToOne(() => Receipt, (receipt) => receipt.lineItems, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'receipt_id' })
  receipt: Receipt;

  @ManyToOne(() => Product, { nullable: true })
  @JoinColumn({ name: 'product_id' })
  product: Product | null;
}
