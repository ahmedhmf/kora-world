import { BadRequestException, ConflictException } from '@nestjs/common';
import { DataSource, QueryFailedError } from 'typeorm';
import { AccountingPostingService, PostAccountingEvent } from './accounting-posting.service';
import { JournalEntryType } from './entities/journal-entry.entity';

const example: PostAccountingEvent = {
  sourceEventKey: 'test:invoice:1:posted:v1',
  date: '2026-11-11',
  description: 'Example payment',
  type: JournalEntryType.MANUAL,
  lines: [
    { accountId: 1, debitCents: 10000, creditCents: 0 },
    { accountId: 2, debitCents: 0, creditCents: 10000 },
  ],
};

describe('AccountingPostingService', () => {
  const manager = {
    findOne: jest.fn(),
    exists: jest.fn(),
    create: jest.fn((_entity: unknown, data: unknown) => data),
    save: jest.fn(async (_entity: unknown, data: unknown) => data),
  };
  const db = {
    transaction: jest.fn(async (callback: (manager: unknown) => Promise<unknown>) => callback(manager)),
  };
  const service = new AccountingPostingService(db as unknown as DataSource);

  beforeEach(() => {
    jest.clearAllMocks();
    manager.findOne.mockImplementation(async (_entity, opts) => ({
      id: opts.where.id,
      isActive: true,
      currency: 'EGP',
    }));
    manager.exists.mockResolvedValue(false);
  });

  it('rejects an unbalanced journal before accessing the database', async () => {
    await expect(service.post({
      ...example,
      lines: [
        { accountId: 1, debitCents: 10000, creditCents: 0 },
        { accountId: 2, debitCents: 0, creditCents: 9999 },
      ],
    })).rejects.toThrow(BadRequestException);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it('rejects both debit and credit on the same line', async () => {
    await expect(service.post({
      ...example,
      lines: [
        { accountId: 1, debitCents: 10000, creditCents: 10000 },
        { accountId: 2, debitCents: 0, creditCents: 10000 },
      ],
    })).rejects.toThrow(BadRequestException);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it('posts a balanced journal atomically with its unique source-event key', async () => {
    const result = await service.post(example);
    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(manager.save).toHaveBeenCalledTimes(1);
    expect(result.sourceEventKey).toBe(example.sourceEventKey);
    expect(result.postingStatus).toBe('posted');
    expect(result.lines[0].amountBase).toBe(100);
    expect(result.lines[1].amountBase).toBe(-100);
  });

  it('rejects inactive accounts', async () => {
    manager.findOne.mockResolvedValue({ id: 1, isActive: false, currency: 'EGP' });
    await expect(service.post(example)).rejects.toThrow(BadRequestException);
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('maps PostgreSQL uniqueness failures to a conflict', async () => {
    const uniqueFailure = new QueryFailedError('INSERT', [], { code: '23505' } as never);
    db.transaction.mockRejectedValueOnce(uniqueFailure);
    await expect(service.post(example)).rejects.toThrow(ConflictException);
  });
});
