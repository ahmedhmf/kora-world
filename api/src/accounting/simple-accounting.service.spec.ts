import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SimpleAccountingService, SimpleTransactionInput } from './simple-accounting.service';
import { JournalWorkflowService } from './journal-workflow.service';

describe('SimpleAccountingService', () => {
  let role = 'employee';
  const repoUser = { findOneBy: jest.fn(async () => ({ id: 1, role })) };
  const repoAccounts = {
    findOneBy: jest.fn(async ({ id }: { id: number }) => ({
      id, type: id === 11 || id === 12 ? 'asset' : id === 40 ? 'expense' : 'revenue',
      code: id === 11 ? '1101' : id === 12 ? '1102' : id === 40 ? '5101' : '4101',
      isActive: true, currency: 'EGP',
    })),
    existsBy: jest.fn(async () => false),
  };
  const db = {
    getRepository: jest.fn((entity: { name: string }) => entity.name === 'User' ? repoUser : repoAccounts),
  };
  const workflow = {
    createDraft: jest.fn(async (_event: unknown, _userId: number) => ({ id: 99 })),
    submit: jest.fn(async (_id: number, _userId: number) => ({ id: 99 })),
    approveAndPost: jest.fn(async (_id: number, _userId: number) => ({ id: 99 })),
  };
  const service = new SimpleAccountingService(
    db as unknown as DataSource,
    workflow as unknown as JournalWorkflowService,
  );
  const expense: SimpleTransactionInput = {
    kind: 'expense', date: '2026-11-11', description: 'Office supplies',
    amountCents: 12345, cashAccountId: 11, categoryAccountId: 40,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    role = 'employee';
  });

  it('maps an expense to expense debit and bank credit, pending employee approval', async () => {
    const result = await service.create(expense, 1);
    expect(result.status).toBe('pending_approval');
    const event = workflow.createDraft.mock.calls[0][0];
    expect(event.lines).toEqual([
      { accountId: 40, debitCents: 12345, creditCents: 0 },
      { accountId: 11, debitCents: 0, creditCents: 12345 },
    ]);
    expect(workflow.approveAndPost).not.toHaveBeenCalled();
  });

  it('maps other income to bank debit and revenue credit', async () => {
    await service.create({
      ...expense, kind: 'income', categoryAccountId: 50,
    }, 1);
    expect(workflow.createDraft.mock.calls[0][0].lines).toEqual([
      { accountId: 11, debitCents: 12345, creditCents: 0 },
      { accountId: 50, debitCents: 0, creditCents: 12345 },
    ]);
  });

  it('maps transfer between bank accounts to opposite asset entries', async () => {
    await service.create({
      ...expense, kind: 'transfer', categoryAccountId: undefined,
      destinationAccountId: 12,
    }, 1);
    expect(workflow.createDraft.mock.calls[0][0].lines).toEqual([
      { accountId: 12, debitCents: 12345, creditCents: 0 },
      { accountId: 11, debitCents: 0, creditCents: 12345 },
    ]);
  });

  it('allows Admin to submit and immediately post', async () => {
    role = 'admin';
    const result = await service.create(expense, 1);
    expect(result.status).toBe('posted');
    expect(workflow.approveAndPost).toHaveBeenCalledWith(99, 1);
  });

  it('blocks supplier users', async () => {
    role = 'supplier';
    await expect(service.create(expense, 1)).rejects.toThrow(ForbiddenException);
  });

  it('blocks zero amounts and non-integer EGP cents', async () => {
    await expect(service.create({ ...expense, amountCents: 0 }, 1))
      .rejects.toThrow(BadRequestException);
    await expect(service.create({ ...expense, amountCents: 123.45 }, 1))
      .rejects.toThrow(BadRequestException);
  });

  it('blocks same-account transfers', async () => {
    await expect(service.create({
      ...expense, kind: 'transfer', categoryAccountId: undefined,
      destinationAccountId: 11,
    }, 1)).rejects.toThrow(BadRequestException);
  });

  it('rejects inappropriate asset category for expenses', async () => {
    await expect(service.create({ ...expense, categoryAccountId: 12 }, 1))
      .rejects.toThrow(BadRequestException);
  });
});
