import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('accounts')
export class Account {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'company_name', length: 150 })
  companyName: string;

  @Column({ name: 'account_number', length: 50, unique: true })
  accountNumber: string;

  @Column({ length: 50, default: 'under_discussion' })
  status: string;

  @Column({ name: 'customer_type', length: 50 })
  customerType: string;

  @Column({ length: 255, nullable: true })
  website?: string;

  @Column({ name: 'primary_contact_name', length: 150 })
  primaryContactName: string;

  @Column({ name: 'primary_contact_email', length: 150 })
  primaryContactEmail: string;

  @Column({ name: 'primary_contact_phone', length: 100, nullable: true })
  primaryContactPhone?: string;

  @Column({ name: 'billing_street', length: 255, nullable: true })
  billingStreet?: string;

  @Column({ name: 'billing_city', length: 150, nullable: true })
  billingCity?: string;

  @Column({ name: 'billing_zip', length: 50, nullable: true })
  billingZip?: string;

  @Column({ name: 'billing_country', length: 150, nullable: true })
  billingCountry?: string;

  @Column({ name: 'shipping_street', length: 255, nullable: true })
  shippingStreet?: string;

  @Column({ name: 'shipping_city', length: 150, nullable: true })
  shippingCity?: string;

  @Column({ name: 'shipping_zip', length: 50, nullable: true })
  shippingZip?: string;

  @Column({ name: 'shipping_country', length: 150, nullable: true })
  shippingCountry?: string;

  @Column({ name: 'default_currency', length: 10, default: 'USD' })
  defaultCurrency: string;

  @Column({ name: 'payment_model', type: 'varchar', length: 150, nullable: true })
  paymentModel?: string | null;

  @Column({ name: 'consignment_pricing_method', type: 'varchar', length: 20, nullable: true })
  consignmentPricingMethod?: string | null;

  @Column({ name: 'consignment_share_percent', type: 'numeric', precision: 5, scale: 2, nullable: true, transformer: { to: (v: number | null) => v, from: (v: string | null) => v == null ? null : Number(v) } })
  consignmentSharePercent?: number | null;

  @Column({ name: 'settlement_due_day', type: 'int', nullable: true })
  settlementDueDay?: number | null;

  @Column({ name: 'upfront_percent', type: 'numeric', precision: 5, scale: 2, nullable: true, transformer: { to: (v: number | null) => v, from: (v: string | null) => v == null ? null : Number(v) } })
  upfrontPercent?: number | null;

  @Column({ name: 'balance_due', type: 'varchar', length: 40, nullable: true })
  balanceDue?: string | null;

  @Column({ name: 'payment_terms', length: 50, default: 'Cash in Advance' })
  paymentTerms: string;

  @Column({
    name: 'credit_limit',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0.0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value) || 0,
    },
  })
  creditLimit: number;

  @Column({ name: 'vat_number', length: 100, nullable: true })
  vatNumber?: string;

  @Column({ name: 'assigned_sales_rep_id', nullable: true })
  assignedSalesRepId?: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'assigned_sales_rep_id' })
  assignedSalesRep?: User;

  @Column({ type: 'text', nullable: true })
  remarks?: string;

  @Column({ type: 'jsonb', default: [] })
  forecasts: Array<{
    id: string;
    year: number;
    status: 'draft' | 'po_created';
    items: Array<{
      productId: number;
      quantity: number;
      orderedQuantity?: number;
    }>;
  }>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
