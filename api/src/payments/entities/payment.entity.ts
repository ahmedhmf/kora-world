import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Invoice } from '../../invoices/entities/invoice.entity';
import { AccountingAccount } from '../../accounting/entities/accounting-account.entity';
import { PurchaseOrder } from '../../purchase-orders/entities/purchase-order.entity';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'integer', name: 'invoice_id', nullable: true })
  invoiceId?: number | null;

  @Column({ length: 255, default: '' })
  description: string;

  @Column({ type: 'integer', name: 'paid_from_account_id', nullable: true })
  paidFromAccountId: number;

  @Column({ type: 'integer', name: 'category_account_id', nullable: true })
  categoryAccountId: number;

  @Column({ type: 'integer', name: 'po_id', nullable: true })
  poId?: number | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  attachment?: string | null;

  @Column({ type: 'date' })
  date: Date | string;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value) || 0,
    },
  })
  amount: number;

  @Column({ length: 10 })
  currency: string;

  @Column({
    name: 'exchange_rate',
    type: 'numeric',
    precision: 12,
    scale: 6,
    default: 1.0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value) || 1.0,
    },
  })
  exchangeRate: number;

  @Column({
    name: 'amount_base',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0.0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value) || 0,
    },
  })
  amountBase: number;

  @Column({
    name: 'amount_egp',
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value) || 0,
    },
  })
  amountEgp?: number;

  @Column({ length: 50 })
  method: string;

  @Column({ length: 100, nullable: true })
  reference?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @ManyToOne(() => Invoice, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'invoice_id' })
  invoice?: Invoice | null;

  @ManyToOne(() => AccountingAccount, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'paid_from_account_id' })
  paidFromAccount?: AccountingAccount;

  @ManyToOne(() => AccountingAccount, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'category_account_id' })
  categoryAccount?: AccountingAccount;

  @ManyToOne(() => PurchaseOrder, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'po_id' })
  purchaseOrder?: PurchaseOrder | null;
}
