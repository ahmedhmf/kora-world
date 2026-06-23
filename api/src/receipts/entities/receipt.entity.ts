import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Account } from '../../accounts/entities/account.entity';
import { ReceiptLineItem } from './receipt-line-item.entity';

export enum ReceiptStatus {
  DRAFT = 'draft',
  ISSUED = 'issued',
  PAID = 'paid',
  OVERDUE = 'overdue',
  CANCELLED = 'cancelled',
}

const numericTransformer = {
  to: (value: number) => value,
  from: (value: string) => parseFloat(value) || 0,
};

@Entity('receipts')
export class Receipt {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'receipt_number', length: 50, unique: true })
  receiptNumber: string;

  @Column({ name: 'account_id' })
  accountId: number;

  @Column({
    type: 'varchar',
    length: 20,
    default: ReceiptStatus.DRAFT,
  })
  status: ReceiptStatus;

  @Column({ name: 'issue_date', type: 'date' })
  issueDate: Date;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate: Date | null;

  @Column({ length: 10, default: 'USD' })
  currency: string;

  @Column({
    name: 'payment_terms',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  paymentTerms: string | null;

  @Column({
    name: 'vat_rate',
    type: 'numeric',
    precision: 5,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  vatRate: number;

  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  subtotal: number;

  @Column({
    name: 'discount_amount',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  discountAmount: number;

  @Column({
    name: 'tax_amount',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  taxAmount: number;

  @Column({
    name: 'total_amount',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  totalAmount: number;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => Account)
  @JoinColumn({ name: 'account_id' })
  account: Account;

  @OneToMany(() => ReceiptLineItem, (item) => item.receipt, { cascade: true })
  lineItems: ReceiptLineItem[];
}
