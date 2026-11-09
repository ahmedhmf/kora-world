import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('delivery_notes')
export class DeliveryNote {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'account_id', type: 'int' })
  accountId: number;

  @Column({ name: 'note_number', type: 'varchar', length: 40, unique: true })
  noteNumber: string;

  @Column({ name: 'delivery_date', type: 'date' })
  deliveryDate: string;

  @Column({ name: 'customer_name', type: 'varchar', length: 150 })
  customerName: string;

  @Column({ name: 'delivery_address', type: 'text', nullable: true })
  deliveryAddress?: string | null;

  @Column({ name: 'payment_model', type: 'varchar', length: 150, nullable: true })
  paymentModel?: string | null;

  @Column({ type: 'jsonb' })
  items: Array<{ productId: number; articleNumber: string; productName: string; quantity: number }>;

  @Column({ type: 'text', nullable: true })
  remarks?: string | null;

  @Column({ name: 'signed_file_path', type: 'varchar', length: 255, nullable: true })
  signedFilePath?: string | null;

  @Column({ name: 'signed_file_name', type: 'varchar', length: 255, nullable: true })
  signedFileName?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
