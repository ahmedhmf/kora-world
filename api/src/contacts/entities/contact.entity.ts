import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Supplier } from '../../suppliers/entities/supplier.entity.js';
import { Account } from '../../accounts/entities/account.entity.js';

@Entity('contacts')
export class Contact {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 150 })
  name: string;

  @Column({ length: 150, nullable: true })
  company?: string;

  @Column({ length: 100, nullable: true })
  position?: string;

  @Column({ length: 50 })
  type: string; // marketing, legal, finance, supplier, account, driver, warehouse

  @Column({ name: 'supplier_id', nullable: true })
  supplierId?: number;

  @ManyToOne(() => Supplier)
  @JoinColumn({ name: 'supplier_id' })
  supplier?: Supplier;

  @Column({ name: 'account_id', nullable: true })
  accountId?: number;

  @ManyToOne(() => Account)
  @JoinColumn({ name: 'account_id' })
  account?: Account;

  @Column({ type: 'jsonb', nullable: true })
  phones?: { number: string; label: string }[];

  @Column({ length: 150, nullable: true })
  email?: string;

  @Column({ length: 50, nullable: true })
  whatsapp?: string;

  @Column({ length: 255, nullable: true })
  facebook?: string;

  @Column({ length: 255, nullable: true })
  instagram?: string;

  @Column({ type: 'text', nullable: true })
  address?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
