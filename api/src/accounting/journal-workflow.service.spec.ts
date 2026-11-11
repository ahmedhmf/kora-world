import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { JournalWorkflowService } from './journal-workflow.service';
import { JournalEntryType } from './entities/journal-entry.entity';

describe('JournalWorkflowService', () => {
  const manager = {
    findOne: jest.fn(),
    find: jest.fn(),
    exists: jest.fn(),
    create: jest.fn((_entity: unknown, value: unknown) => value),
    save: jest.fn(async (_entity: unknown, value: unknown) => value),
  };
  const db = {
    transaction: jest.fn(async (fn: (m: unknown) => Promise<unknown>) => fn(manager)),
  };
  const service = new JournalWorkflowService(db as unknown as DataSource);
  const lines = [
    { accountId: 1, debitCents: 1234, creditCents: 0 },
    { accountId: 2, debitCents: 0, creditCents: 1234 },
  ];
  const draft = { date: '2026-11-11', description: 'Sample manual journal', lines };

  beforeEach(() => {
    jest.clearAllMocks();
    manager.findOne.mockImplementation(async (cls, opts) => {
      if (cls.name === 'User') return { id: opts.where.id, role: opts.where.id === 2 ? 'accountant' : 'employee' };
      if (cls.name === 'AccountingAccount') {
        return { id: opts.where.id, currency: 'EGP', isActive: true };
      }
      if (cls.name === 'JournalEntry') {
        return {
          id: opts.where.id, type: JournalEntryType.MANUAL, postingStatus: 'pending_approval',
          createdById: 1, submittedById: 1, date: '2026-11-11',
          description: 'Sample manual journal',
        };
      }
      return null;
    });
    manager.exists.mockResolvedValue(false);
    manager.find.mockResolvedValue([
      { id: 10, journalEntryId: 5, accountId: 1, debit: 12.34, credit: 0, amountBase: 12.34, exchangeRate: 1, currency: 'EGP' },
      { id: 11, journalEntryId: 5, accountId: 2, debit: 0, credit: 12.34, amountBase: -12.34, exchangeRate: 1, currency: 'EGP' },
    ]);
  });

  it('creates a balanced draft without posting it', async () => {
    const result = await service.createDraft(draft, 1);
    expect(result.postingStatus).toBe('draft');
    expect(result.createdById).toBe(1);
    expect(result.lines).toHaveLength(2);
    expect(result.postedAt).toBeUndefined();
  });

  it('rejects invalid draft amounts before writing', async () => {
    await expect(service.createDraft({
      ...draft, lines: [lines[0], { ...lines[1], creditCents: 1200 }],
    }, 1)).rejects.toThrow(BadRequestException);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it('allows a different accountant to approve a submitted manual journal', async () => {
    const result = await service.approveAndPost(5, 2);
    expect(result.postingStatus).toBe('posted');
    expect(result.approvedById).toBe(2);
    expect(result.sourceEventKey).toBe('manual:journal:5:posted:v1');
  });

  it('refuses self-approval even if the creator is an accountant', async () => {
    await expect(service.approveAndPost(5, 1)).rejects.toThrow(ForbiddenException);
  });

  it('allows an administrator to approve their own submitted journal', async () => {
    manager.findOne.mockImplementation(async (cls, opts) => {
      if (cls.name === 'User') return { id: opts.where.id, role: 'admin' };
      if (cls.name === 'AccountingAccount') {
        return { id: opts.where.id, currency: 'EGP', isActive: true };
      }
      if (cls.name === 'JournalEntry') {
        return {
          id: opts.where.id, type: JournalEntryType.MANUAL,
          postingStatus: 'pending_approval', createdById: 4, submittedById: 4,
          date: '2026-11-11', description: 'Administrator test journal',
        };
      }
      return null;
    });
    const result = await service.approveAndPost(5, 4);
    expect(result.postingStatus).toBe('posted');
    expect(result.approvedById).toBe(4);
    expect(result.sourceEventKey).toBe('manual:journal:5:posted:v1');
  });

  it('allows an administrator to submit a draft created by another employee', async () => {
    manager.findOne.mockImplementation(async (cls, opts) => {
      if (cls.name === 'User') return { id: opts.where.id, role: 'admin' };
      if (cls.name === 'JournalEntry') {
        return {
          id: opts.where.id, type: JournalEntryType.MANUAL,
          postingStatus: 'draft', createdById: 1,
        };
      }
      return null;
    });
    const result = await service.submit(5, 4);
    expect(result.postingStatus).toBe('pending_approval');
    expect(result.submittedById).toBe(4);
  });

  it('prevents an accountant from approving a journal they submitted for someone else', async () => {
    manager.findOne.mockImplementation(async (cls, opts) => {
      if (cls.name === 'User') return { id: opts.where.id, role: 'accountant' };
      if (cls.name === 'JournalEntry') {
        return {
          id: opts.where.id, type: JournalEntryType.MANUAL,
          postingStatus: 'pending_approval', createdById: 1, submittedById: 2,
        };
      }
      return null;
    });
    await expect(service.approveAndPost(5, 2)).rejects.toThrow(ForbiddenException);
  });

  it('refuses approval by a non-accountant', async () => {
    manager.findOne.mockImplementation(async (cls, opts) => {
      if (cls.name === 'User') return { id: opts.where.id, role: 'employee' };
      return null;
    });
    await expect(service.approveAndPost(5, 3)).rejects.toThrow(ForbiddenException);
  });

  it('refuses posting if journal currency was modified', async () => {
    manager.find.mockResolvedValue([
      { journalEntryId: 5, accountId: 1, debit: 12.34, credit: 0, amountBase: 12.34, currency: 'USD', exchangeRate: 1 },
      { journalEntryId: 5, accountId: 2, debit: 0, credit: 12.34, amountBase: -12.34, currency: 'EGP', exchangeRate: 1 },
    ]);
    await expect(service.approveAndPost(5, 2)).rejects.toThrow(BadRequestException);
  });

  it('allows the creator to submit a draft for approval', async () => {
    manager.findOne.mockImplementation(async (cls, opts) => {
      if (cls.name === 'User') return { id: 1, role: 'employee' };
      if (cls.name === 'JournalEntry') {
        return { id: opts.where.id, type: JournalEntryType.MANUAL, postingStatus: 'draft', createdById: 1 };
      }
      return null;
    });
    const result = await service.submit(5, 1);
    expect(result.postingStatus).toBe('pending_approval');
    expect(result.submittedById).toBe(1);
    expect(result.submittedAt).toBeInstanceOf(Date);
  });

  it('rejects draft submission by another employee', async () => {
    manager.findOne.mockImplementation(async (cls, opts) => {
      if (cls.name === 'User') return { id: opts.where.id, role: 'employee' };
      if (cls.name === 'JournalEntry') {
        return { id: opts.where.id, type: JournalEntryType.MANUAL, postingStatus: 'draft', createdById: 1 };
      }
      return null;
    });
    await expect(service.submit(5, 3)).rejects.toThrow(ForbiddenException);
  });

  it('reverses a posted journal with opposite lines and marks the original reversed', async () => {
    manager.findOne.mockImplementation(async (cls, opts) => {
      if (cls.name === 'User') return { id: opts.where.id, role: 'accountant' };
      if (cls.name === 'JournalEntry' && opts.where.reversalOfId) return null;
      if (cls.name === 'JournalEntry') {
        return { id: opts.where.id, type: JournalEntryType.MANUAL, postingStatus: 'posted', createdById: 1 };
      }
      return null;
    });
    manager.find.mockResolvedValue([
      { journalEntryId: 5, accountId: 1, debit: 12.34, credit: 0, amountBase: 12.34, amountEgp: 12.34, currency: 'EGP', exchangeRate: 1 },
      { journalEntryId: 5, accountId: 2, debit: 0, credit: 12.34, amountBase: -12.34, amountEgp: -12.34, currency: 'EGP', exchangeRate: 1 },
    ]);
    const reversal = await service.reverse(5, 2, 'Correction');
    expect(reversal.reversalOfId).toBe(5);
    expect(reversal.lines[0].credit).toBe(12.34);
    expect(reversal.lines[1].debit).toBe(12.34);
    expect(reversal.lines[0].amountBase).toBe(-12.34);
    expect(manager.save).toHaveBeenCalledTimes(2);
    expect(manager.save.mock.calls[1][1].postingStatus).toBe('reversed');
  });

  it('refuses reversal without an explanation', async () => {
    await expect(service.reverse(5, 2, ' ')).rejects.toThrow(BadRequestException);
  });

  it('refuses reversal when journal is not posted', async () => {
    await expect(service.reverse(5, 2, 'Correcting entry')).rejects.toThrow(BadRequestException);
  });
});
