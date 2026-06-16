import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { PurchaseOrder } from '../../purchase-orders/entities/purchase-order.entity';
import { Invoice } from '../../invoices/entities/invoice.entity';
import { JournalLine } from './journal-line.entity';

export enum JournalEntryType {
  MANUAL = 'manual',
  PO = 'po',
  INVOICE = 'invoice',
  PAYMENT = 'payment',
}

@Entity('journal_entries')
export class JournalEntry {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'date' })
  date: Date | string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ length: 100, nullable: true })
  reference?: string;

  @Column({
    type: 'varchar',
    length: 50,
  })
  type: JournalEntryType;

  @Column({ type: 'integer', name: 'po_id', nullable: true })
  poId?: number | null;

  @Column({ type: 'integer', name: 'invoice_id', nullable: true })
  invoiceId?: number | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  attachment?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => PurchaseOrder, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'po_id' })
  purchaseOrder?: PurchaseOrder | null;

  @ManyToOne(() => Invoice, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'invoice_id' })
  invoice?: Invoice | null;

  @OneToMany(() => JournalLine, (line) => line.journalEntry, { cascade: true })
  lines: JournalLine[];
}
