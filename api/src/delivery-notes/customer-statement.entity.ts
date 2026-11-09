import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('customer_statements')
export class CustomerStatement {
  @PrimaryGeneratedColumn() id: number;
  @Column({ name: 'account_id', type: 'int' }) accountId: number;
  @Column({ type: 'varchar', length: 3 }) currency: string;
  @Column({ name: 'period_from', type: 'date' }) periodFrom: string;
  @Column({ name: 'period_to', type: 'date' }) periodTo: string;
  @Column({ type: 'jsonb' }) snapshot: Record<string, unknown>;
  @Column({ name: 'created_by_id', type: 'int' }) createdById: number;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
