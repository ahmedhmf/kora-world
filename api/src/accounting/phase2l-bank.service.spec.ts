import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Phase2LBankService } from './phase2l-bank.service';
import { AccountingAccount, AccountType } from './entities/accounting-account.entity';
import { JournalEntry } from './entities/journal-entry.entity';

describe('Phase 2L bank/opening pilot guards', () => {
  const saved = {
    flag: process.env.ACCOUNTING_PHASE2L,
    db: process.env.DATABASE_NAME, host: process.env.DATABASE_HOST,
  };
  const manager = {
    query: jest.fn(),
    findOne: jest.fn(),
    exists: jest.fn(),
    createQueryBuilder: jest.fn(),
    create: jest.fn((_entity: unknown, value: unknown) => value),
    save: jest.fn(),
  };
  const db = {
    transaction: jest.fn(async (_isolation: string, callback: (m: typeof manager) => Promise<unknown>) => callback(manager)),
  };
  const service = new Phase2LBankService(db as unknown as DataSource);
  const opening = () => service.postOpening({
    date: '2026-01-01',
    reference: 'OPEN-2026-LOCAL',
    lines: [
      { accountId: 1, debitCents: 50000, creditCents: 0 },
      { accountId: 2, debitCents: 0, creditCents: 50000 },
    ],
  }, 9);
  const importBank = () => service.importStatement({
    accountId: 1, statementKey: 'BANK-2026-11',
    openingBalanceCents: 50000, closingBalanceCents: 47655,
    rows: [{ date: '2026-11-27', amountCents: -2345, reference: 'MRKT', description: 'Marketing' }],
  }, 9);

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ACCOUNTING_PHASE2L = 'true';
    process.env.DATABASE_NAME = 'kora_test';
    process.env.DATABASE_HOST = '127.0.0.1';
    manager.query.mockImplementation(async (sql: string) => {
      if (sql.includes('current_database()')) return [{ name: 'kora_test' }];
      if (sql.includes('SELECT id FROM accounting_bank_statement_imports')) return [];
      if (sql.includes('RETURNING id')) return [{ id: 60 }];
      return [];
    });
    manager.findOne.mockImplementation(async (entity: unknown, input: { where: { id?: number; sourceEventKey?: string } }) => {
      if (entity === JournalEntry) return null;
      if (entity === AccountingAccount) {
        return {
          id: input.where.id, code: input.where.id === 1 ? '1102' : '3100',
          type: input.where.id === 1 ? AccountType.ASSET : AccountType.EQUITY,
          currency: 'EGP', isActive: true,
        };
      }
      return null;
    });
    manager.exists.mockResolvedValue(false);
    manager.createQueryBuilder.mockReturnValue({
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(0),
    });
    manager.save.mockResolvedValue({ id: 10 });
  });

  afterAll(() => {
    const vars = {
      ACCOUNTING_PHASE2L: saved.flag, DATABASE_NAME: saved.db, DATABASE_HOST: saved.host,
    };
    for (const [name, value] of Object.entries(vars)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  it('rejects production database even with pilot feature enabled', async () => {
    process.env.DATABASE_NAME = 'kora_world';
    await expect(opening()).rejects.toThrow(ForbiddenException);
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('rejects mismatched actual database identity', async () => {
    manager.query.mockResolvedValue([{ name: 'kora_world' }]);
    await expect(opening()).rejects.toThrow(ForbiddenException);
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('rejects an unbalanced opening journal', async () => {
    await expect(service.postOpening({
      date: '2026-01-01', reference: 'OPEN-2026-TEST',
      lines: [
        { accountId: 1, debitCents: 100, creditCents: 0 },
        { accountId: 2, debitCents: 0, creditCents: 99 },
      ],
    }, 9)).rejects.toThrow(BadRequestException);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it('rejects negative amounts even if the debit and credit sums might match', async () => {
    await expect(service.postOpening({
      date: '2026-01-01', reference: 'OPEN-2026-TEST',
      lines: [
        { accountId: 1, debitCents: 100, creditCents: -50 },
        { accountId: 2, debitCents: 0, creditCents: 100 },
      ],
    }, 9)).rejects.toThrow(BadRequestException);
  });

  it('posts a single balanced EGP opening journal with the reference key', async () => {
    expect(await opening()).toEqual({ journalId: 10, replayed: false });
    expect(manager.save).toHaveBeenCalledTimes(1);
    const savedJournal = manager.save.mock.calls[0][1] as {
      sourceEventKey: string; postingStatus: string; lines: Array<{
        accountId: number; debit: number; credit: number; amountBase: number;
      }>;
    };
    expect(savedJournal.sourceEventKey).toBe('phase2l-opening:OPEN-2026-LOCAL');
    expect(savedJournal.postingStatus).toBe('posted');
    expect(savedJournal.lines).toEqual(expect.arrayContaining([
      expect.objectContaining({ accountId: 1, debit: 500, credit: 0, amountBase: 500 }),
      expect.objectContaining({ accountId: 2, debit: 0, credit: 500, amountBase: -500 }),
    ]));
  });

  it('does not post opening balance onto an account with existing activity', async () => {
    manager.createQueryBuilder.mockReturnValue({
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(1),
    });
    await expect(opening()).rejects.toThrow(ConflictException);
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('refuses a statement whose opening plus rows do not equal closing', async () => {
    await expect(service.importStatement({
      accountId: 1, statementKey: 'BANK-2026-11',
      openingBalanceCents: 50000, closingBalanceCents: 50000,
      rows: [{ date: '2026-11-27', amountCents: -2345 }],
    }, 9)).rejects.toThrow(BadRequestException);
  });

  it('imports validated bank rows without creating payment or journal records', async () => {
    expect(await importBank()).toEqual({ importId: 60, rowCount: 1 });
    expect(manager.save).not.toHaveBeenCalled();
    const statements = manager.query.mock.calls.filter(([sql]: [string]) =>
      sql.includes('INSERT INTO accounting_bank_statement'));
    expect(statements).toHaveLength(2);
    expect(manager.query.mock.calls.some(([sql]: [string]) =>
      sql.includes('INSERT INTO journal_entries'))).toBe(false);
  });

  it('rejects same bank import key', async () => {
    manager.query.mockImplementation(async (sql: string) => {
      if (sql.includes('current_database()')) return [{ name: 'kora_test' }];
      if (sql.includes('SELECT id FROM accounting_bank_statement_imports')) return [{ id: 3 }];
      return [];
    });
    await expect(importBank()).rejects.toThrow(ConflictException);
  });

  it('rejects a match with wrong date or signed amount', async () => {
    manager.query.mockImplementation(async (sql: string) => {
      if (sql.includes('current_database()')) return [{ name: 'kora_test' }];
      if (sql.includes('FROM accounting_bank_statement_rows WHERE id=$1 FOR UPDATE')) return [{
        id: 3, accountId: 1, date: '2026-11-27', amountCents: '-2345',
        matchedJournalLineId: null,
      }];
      if (sql.includes('FROM journal_lines l JOIN journal_entries')) return [{
        id: 5, accountId: 1, date: '2026-11-27', postingStatus: 'posted', amountCents: '-2000',
      }];
      return [];
    });
    await expect(service.match(3, 5, 'Verified from bank', 9)).rejects.toThrow(ConflictException);
    expect(manager.query.mock.calls.some(([sql]: [string]) =>
      sql.includes('UPDATE accounting_bank_statement_rows'))).toBe(false);
  });

  it('prevents matching an already-matched row', async () => {
    manager.query.mockImplementation(async (sql: string) => {
      if (sql.includes('current_database()')) return [{ name: 'kora_test' }];
      if (sql.includes('FROM accounting_bank_statement_rows WHERE id=$1 FOR UPDATE')) return [{
        id: 3, accountId: 1, date: '2026-11-27', amountCents: '-2345',
        matchedJournalLineId: 6,
      }];
      return [];
    });
    await expect(service.match(3, 5, 'Verified from bank', 9)).rejects.toThrow(ConflictException);
  });
});
