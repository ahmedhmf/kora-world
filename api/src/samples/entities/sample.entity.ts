import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Supplier } from '../../suppliers/entities/supplier.entity';
import { ProductCategory } from '../../products/entities/product.entity';

export enum SampleStatus {
  REQUESTED = 'requested',
  SHIPPED = 'shipped',
  RECEIVED = 'received',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('samples')
export class Sample {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'supplier_id' })
  supplierId: number;

  @Column({ length: 150 })
  name: string;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  category?: ProductCategory;

  @Column({
    type: 'varchar',
    length: 50,
    default: SampleStatus.REQUESTED,
  })
  status: SampleStatus;

  @Column({ type: 'jsonb', nullable: true })
  construction?: Record<string, string>;

  @Column({ name: 'tech_pack_path', length: 255, nullable: true })
  techPackPath?: string;

  @Column({ name: 'tech_pack_name', length: 255, nullable: true })
  techPackName?: string;

  @Column({ length: 100, nullable: true })
  carrier?: string;

  @Column({ name: 'tracking_number', length: 100, nullable: true })
  trackingNumber?: string;

  @Column({ type: 'text', nullable: true })
  comments?: string;

  @Column({ name: 'parent_sample_id', nullable: true })
  parentSampleId?: number | null;

  @Column({ name: 'round_number', default: 1 })
  roundNumber: number;

  @ManyToOne(() => Sample, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'parent_sample_id' })
  parentSample?: Sample | null;

  @Column({ name: 'receipt_protocol', type: 'jsonb', nullable: true })
  receiptProtocol?: Record<string, unknown> | null;

  @Column({ name: 'article_number', length: 50, nullable: true })
  articleNumber?: string;

  @Column({ length: 10, nullable: true })
  collection?: string;

  @Column({ type: 'integer', nullable: true })
  year?: number;

  @Column({ name: 'article_counter', type: 'integer', nullable: true })
  articleCounter?: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Supplier, (supplier) => supplier.purchaseOrders, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;
}
