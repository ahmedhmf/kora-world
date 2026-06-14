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

export enum PrototypeStatus {
  REQUESTED = 'requested',
  SHIPPED = 'shipped',
  RECEIVED = 'received',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('prototypes')
export class Prototype {
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
    default: PrototypeStatus.REQUESTED,
  })
  status: PrototypeStatus;

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

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Supplier, (supplier) => supplier.purchaseOrders, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;
}
