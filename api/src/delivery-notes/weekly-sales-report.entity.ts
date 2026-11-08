import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('weekly_sales_reports')
export class WeeklySalesReport {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'account_id', type: 'int' })
  accountId: number;

  @Column({ name: 'week_start', type: 'date' })
  weekStart: string;

  @Column({ name: 'week_end', type: 'date' })
  weekEnd: string;

  @Column({ type: 'varchar', length: 20, default: 'draft' })
  status: 'draft' | 'approved' | 'cancelled';

  @Column({ name: 'retail_prices', type: 'jsonb', nullable: true })
  retailPrices?: Record<string, string> | null;

  @Column({ type: 'jsonb' })
  items: Array<{ productId: number; articleNumber: string; productName: string; quantity: number }>;

  @Column({ name: 'file_path', type: 'varchar', length: 255 })
  filePath: string;

  @Column({ name: 'file_name', type: 'varchar', length: 255 })
  fileName: string;

  @Column({ type: 'text', nullable: true })
  remarks?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'approved_by_id', type: 'int', nullable: true })
  approvedById?: number | null;

  @Column({ name: 'approved_by_name', type: 'varchar', length: 255, nullable: true })
  approvedByName?: string | null;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt?: Date | null;

  @Column({ name: 'cancelled_by_id', type: 'int', nullable: true })
  cancelledById?: number | null;

  @Column({ name: 'cancelled_by_name', type: 'varchar', length: 255, nullable: true })
  cancelledByName?: string | null;

  @Column({ name: 'cancellation_reason', type: 'text', nullable: true })
  cancellationReason?: string | null;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt?: Date | null;
}
