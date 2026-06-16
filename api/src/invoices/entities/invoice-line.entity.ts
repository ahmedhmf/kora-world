import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Invoice } from './invoice.entity';

@Entity('invoice_lines')
export class InvoiceLine {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'invoice_id' })
  invoiceId: number;

  @Column({ type: 'text' })
  description: string;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 4,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value) || 0,
    },
  })
  quantity: number;

  @Column({
    name: 'unit_price',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value) || 0,
    },
  })
  unitPrice: number;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value) || 0,
    },
  })
  total: number;

  @ManyToOne(() => Invoice, (invoice) => invoice.lines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice;
}
