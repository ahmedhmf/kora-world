import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Supplier } from '../../suppliers/entities/supplier.entity';

export enum ProductCategory {
  FOOTBALL = 'football',
  HANDBALL = 'handball',
  LIFESTYLE = 'lifestyle',
}

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'supplier_id' })
  supplierId: number;

  @Column({ name: 'article_number', length: 100 })
  articleNumber: string;

  @Column({ length: 150 })
  name: string;

  @Column({
    type: 'enum',
    enum: ProductCategory,
    nullable: true,
  })
  category: ProductCategory;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'unit_price', type: 'numeric', precision: 10, scale: 2 })
  unitPrice: number;

  @Column({ length: 10, nullable: true })
  currency: string;

  @Column({ nullable: true })
  moq: number;

  @Column({
    name: 'weight_kg',
    type: 'numeric',
    precision: 6,
    scale: 2,
    nullable: true,
  })
  weightKg: number;

  @Column({ type: 'jsonb', nullable: true })
  construction?: Record<string, string>;

  @Column({ type: 'varchar', name: 'tech_pack_path', length: 255, nullable: true })
  techPackPath?: string | null;

  @Column({ type: 'varchar', name: 'tech_pack_name', length: 255, nullable: true })
  techPackName?: string | null;

  @Column({ type: 'varchar', name: 'image_path', length: 255, nullable: true })
  imagePath?: string | null;

  @Column({ type: 'varchar', name: 'image_name', length: 255, nullable: true })
  imageName?: string | null;

  @Column({ name: 'collection', length: 10, nullable: true })
  collection?: string;

  @Column({ name: 'year', type: 'integer', nullable: true })
  year?: number;

  @Column({ name: 'article_counter', type: 'integer', nullable: true })
  articleCounter?: number;

  @Column({ type: 'varchar', name: 'pricepoint', length: 50, nullable: true })
  pricepoint?: string | null;

  @Column({
    name: 'landing_price',
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  landingPrice?: number;

  @Column({
    name: 'one_pc_price',
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  onePcPrice?: number;

  @Column({
    name: 'bulk_price',
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  bulkPrice?: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Supplier, (supplier) => supplier.products)
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;
}
