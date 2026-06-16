import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Product } from '../../products/entities/product.entity.js';

@Entity('b2c_requests')
export class B2cRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'customer_name', length: 150 })
  customerName: string;

  @Column({ length: 50 })
  channel: string; // instagram, facebook, whatsapp, other

  @Column({ name: 'channel_username', length: 150, nullable: true })
  channelUsername?: string;

  @Column({ length: 50, nullable: true })
  phone?: string;

  @Column({ length: 150, nullable: true })
  email?: string;

  @Column({ name: 'product_id', nullable: true })
  productId?: number;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  product?: Product;

  @Column({ name: 'requested_size', length: 50, nullable: true })
  requestedSize?: string;

  @Column({ name: 'requested_color', length: 50, nullable: true })
  requestedColor?: string;

  @Column({ type: 'integer', default: 1 })
  quantity: number;

  @Column({ length: 50, default: 'pending' })
  status: string; // pending, notified, fulfilled, cancelled

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
