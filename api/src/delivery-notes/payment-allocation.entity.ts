import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('payment_allocations')
export class PaymentAllocation {
  @PrimaryGeneratedColumn() id: number;
  @Column({ name: 'payment_id', type: 'int' }) paymentId: number;
  @Column({ name: 'settlement_id', type: 'int' }) settlementId: number;
  @Column({ name: 'amount_cents', type: 'bigint' }) amountCents: string;
  @Column({ name: 'created_by_id', type: 'int' }) createdById: number;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
