import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';

export enum AccountType {
  ASSET = 'asset',
  LIABILITY = 'liability',
  EQUITY = 'equity',
  REVENUE = 'revenue',
  EXPENSE = 'expense',
}

@Entity('accounting_accounts')
export class AccountingAccount {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, length: 50 })
  code: string;

  @Column({ length: 150 })
  name: string;

  @Column({
    type: 'varchar',
    length: 50,
  })
  type: AccountType;

  @Column({ length: 10, default: 'EUR' })
  currency: string;

  @Column({ type: 'integer', name: 'parent_id', nullable: true })
  parentId?: number | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @ManyToOne(() => AccountingAccount, (account) => account.children, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'parent_id' })
  parent?: AccountingAccount | null;

  @OneToMany(() => AccountingAccount, (account) => account.parent)
  children?: AccountingAccount[];
}
