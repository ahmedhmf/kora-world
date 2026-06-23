import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { JournalEntry } from './journal-entry.entity';
import { AccountingAccount } from './accounting-account.entity';

@Entity('journal_lines')
export class JournalLine {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'journal_entry_id' })
  journalEntryId: number;

  @Column({ name: 'account_id' })
  accountId: number;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0.00,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value) || 0,
    },
  })
  debit: number;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0.00,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value) || 0,
    },
  })
  credit: number;

  @Column({ length: 10 })
  currency: string;

  @Column({
    name: 'exchange_rate',
    type: 'numeric',
    precision: 12,
    scale: 6,
    default: 1.000000,
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
    default: 0.00,
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

  @ManyToOne(() => JournalEntry, (entry) => entry.lines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'journal_entry_id' })
  journalEntry: JournalEntry;

  @ManyToOne(() => AccountingAccount, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'account_id' })
  account: AccountingAccount;
}
