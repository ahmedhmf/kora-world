import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { randomUUID } from 'crypto';
import { User } from '../users/entities/user.entity';
import { AccountingAccount, AccountType } from './entities/accounting-account.entity';
import { JournalWorkflowService } from './journal-workflow.service';

/**
 * Simple Accounting v1: independent EGP cash/bank expense, income, transfer.
 * NOT an invoice receipt, PO/supplier payment, customer settlement or existing payment.
 * This avoids double-posting those legacy workflows before their migration.
 */
export type SimpleTransactionKind = 'expense' | 'income' | 'transfer';

export interface SimpleTransactionInput {
  kind: SimpleTransactionKind;
  date: string;
  description: string;
  amountCents: number;
  cashAccountId: number;
  categoryAccountId?: number;
  destinationAccountId?: number;
}

@Injectable()
export class SimpleAccountingService {
  constructor(
    private readonly db: DataSource,
    private readonly workflow: JournalWorkflowService,
  ) {}

  async create(input: SimpleTransactionInput, userId: number) {
    const user = await this.db.getRepository(User).findOneBy({ id: userId });
    if (!user || !['admin', 'employee', 'accountant'].includes(user.role)) {
      throw new ForbiddenException('This user cannot record business transactions');
    }
    if (!['expense', 'income', 'transfer'].includes(input?.kind)) {
      throw new BadRequestException('Select Money Out, Money In, or Transfer');
    }
    if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) {
      throw new BadRequestException('Amount must be positive whole EGP cents');
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) ||
      Number.isNaN(Date.parse(input.date)) ||
      new Date(input.date).toISOString().slice(0, 10) !== input.date) {
      throw new BadRequestException('Valid transaction date required');
    }
    if (!input.description?.trim() || input.description.trim().length > 500) {
      throw new BadRequestException('Description must be 1–500 characters');
    }

    const expected: Array<{ id: number | undefined; type: AccountType }> = [
      { id: input.cashAccountId, type: AccountType.ASSET },
      ...(input.kind === 'transfer'
        ? [{ id: input.destinationAccountId, type: AccountType.ASSET }]
        : [{ id: input.categoryAccountId,
          type: input.kind === 'expense' ? AccountType.EXPENSE : AccountType.REVENUE }]),
    ];
    if (expected.some(a => !Number.isSafeInteger(a.id) || (a.id ?? 0) <= 0) ||
      expected[0].id === expected[1].id) {
      throw new BadRequestException('Choose two different valid accounts');
    }

    for (const entry of expected) {
      const account = await this.db.getRepository(AccountingAccount).findOneBy({ id: entry.id });
      if (!account || account.type !== entry.type ||
        !account.isActive || account.currency.toUpperCase() !== 'EGP' ||
        await this.db.getRepository(AccountingAccount).existsBy({ parentId: entry.id })) {
        throw new BadRequestException('Selected account is not an eligible active leaf EGP account of the required type');
      }
    }
    const amount = input.amountCents;
    const main = input.cashAccountId;
    const other = expected[1].id!;
    // Correct double entry based on the *business action*; users never enter debit/credit.
    const lines = input.kind === 'expense'
      ? [
        { accountId: other, debitCents: amount, creditCents: 0 },
        { accountId: main, debitCents: 0, creditCents: amount },
      ]
      : input.kind === 'income'
        ? [
          { accountId: main, debitCents: amount, creditCents: 0 },
          { accountId: other, debitCents: 0, creditCents: amount },
        ]
        : [
          { accountId: other, debitCents: amount, creditCents: 0 },
          { accountId: main, debitCents: 0, creditCents: amount },
        ];
    const draft = await this.workflow.createDraft({
      date: input.date,
      description: `[Simple ${input.kind}] ${input.description.trim()}`,
      reference: `S-${randomUUID().slice(0, 8)}`,
      lines,
    }, userId);

    // Employees/accountants follow approval. Admin can finish the workflow alone.
    const pending = await this.workflow.submit(draft.id, userId);
    if (user.role !== 'admin') {
      return { journalId: pending.id, status: 'pending_approval' as const };
    }
    const posted = await this.workflow.approveAndPost(draft.id, userId);
    return { journalId: posted.id, status: 'posted' as const };
  }
}
