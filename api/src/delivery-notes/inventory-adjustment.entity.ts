import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('inventory_adjustments')
export class InventoryAdjustment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'account_id', type: 'int' })
  accountId: number;

  @Column({ name: 'product_id', type: 'int' })
  productId: number;

  @Column({ name: 'article_number', type: 'varchar', length: 255 })
  articleNumber: string;

  @Column({ name: 'product_name', type: 'varchar', length: 255 })
  productName: string;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'varchar', length: 30 })
  reason: string;

  @Column({ type: 'text' })
  notes: string;

  @Column({ name: 'created_by_id', type: 'int' })
  createdById: number;

  @Column({ name: 'created_by_name', type: 'varchar', length: 255 })
  createdByName: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
