import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type PricingKind = 'fixed' | 'customer_fixed' | 'commission_actual' | 'commission_agreed';

@Entity('customer_pricing_rules')
export class CustomerPricingRule {
  @PrimaryGeneratedColumn() id: number;
  @Column({ name: 'account_id', type: 'int' }) accountId: number;
  @Column({ name: 'product_id', type: 'int' }) productId: number;
  @Column({ type: 'varchar', length: 30 }) kind: PricingKind;
  @Column({ type: 'numeric', precision: 14, scale: 2, nullable: true }) unitPrice?: string | null;
  @Column({ name: 'commission_percent', type: 'numeric', precision: 5, scale: 2, nullable: true }) commissionPercent?: string | null;
  @Column({ name: 'agreed_retail_price', type: 'numeric', precision: 14, scale: 2, nullable: true }) agreedRetailPrice?: string | null;
  @Column({ type: 'varchar', length: 3 }) currency: string;
  @Column({ name: 'effective_from', type: 'date' }) effectiveFrom: string;
  @Column({ name: 'effective_to', type: 'date', nullable: true }) effectiveTo?: string | null;
  @Column({ name: 'created_by_id', type: 'int' }) createdById: number;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
