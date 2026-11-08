import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('sales_settlements')
export class SalesSettlement {
  @PrimaryGeneratedColumn() id: number;
  @Column({ name: 'report_id', type: 'int', unique: true }) reportId: number;
  @Column({ name: 'account_id', type: 'int' }) accountId: number;
  @Column({ type: 'varchar', length: 3 }) currency: string;
  @Column({ name: 'total_cents', type: 'bigint' }) totalCents: string;
  @Column({ type: 'jsonb' }) lines: Array<{
    productId: number; articleNumber: string; quantity: number; pricingRuleId: number;
    kind: string; unitRetailCents: number | null; unitSettlementCents: number;
    commissionBasisPoints: number | null; totalCents: number;
  }>;
  @Column({ type: 'varchar', length: 20, default: 'active' }) status: 'active' | 'reversed';
  @Column({ name: 'reversed_at', type: 'timestamptz', nullable: true }) reversedAt?: Date | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
