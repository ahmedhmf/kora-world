import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('customer_payments')
export class CustomerPayment {
  @PrimaryGeneratedColumn() id: number;
  @Column({ name: 'account_id', type: 'int' }) accountId: number;
  @Column({ name: 'amount_cents', type: 'bigint' }) amountCents: string;
  @Column({ type: 'varchar', length: 3 }) currency: string;
  @Column({ name: 'payment_date', type: 'date' }) paymentDate: string;
  @Column({ type: 'varchar', length: 150 }) reference: string;
  @Column({ type: 'varchar', length: 30 }) method: string;
  @Column({ name: 'created_by_id', type: 'int' }) createdById: number;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
