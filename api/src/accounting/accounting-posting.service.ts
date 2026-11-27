import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, QueryFailedError } from 'typeorm';
import { AccountingAccount } from './entities/accounting-account.entity';
import { JournalEntry, JournalEntryType } from './entities/journal-entry.entity';
import { JournalLine } from './entities/journal-line.entity';

/**
 * First, deliberately narrow version of the new posting engine.
 * EGP-only until a separate, tested FX policy is implemented.
 * Nothing calls this service from the legacy invoice/payment workflow yet.
 */
export interface PostingLine {
  accountId: number;
  debitCents: number;
  creditCents: number;
}
export interface PostAccountingEvent {
  sourceEventKey: string;
  date: string;
  description: string;
  reference?: string;
  type: JournalEntryType;
  lines: PostingLine[];
}

@Injectable()
export class AccountingPostingService {
  constructor(private readonly db: DataSource) {}

  async post(event: PostAccountingEvent): Promise<JournalEntry> {
    if (!event.sourceEventKey?.trim() || event.sourceEventKey.length > 255) {
      throw new BadRequestException('A valid source event key is required');
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(event.date) ||
      Number.isNaN(Date.parse(event.date)) ||
      new Date(event.date).toISOString().slice(0, 10) !== event.date) {
      throw new BadRequestException('Invalid posting date');
    }
    if (!event.description?.trim() || !Object.values(JournalEntryType).includes(event.type)) {
      throw new BadRequestException('Description and journal type are required');
    }
    if (!Array.isArray(event.lines) || event.lines.length < 2) {
      throw new BadRequestException('At least two journal lines are required');
    }

    let debitCents = 0;
    let creditCents = 0;
    for (const line of event.lines) {
      if (!Number.isSafeInteger(line.accountId) || line.accountId <= 0 ||
          !Number.isSafeInteger(line.debitCents) || !Number.isSafeInteger(line.creditCents) ||
          line.debitCents < 0 || line.creditCents < 0 ||
          (line.debitCents > 0) === (line.creditCents > 0)) {
        throw new BadRequestException('Each line must have one positive debit or credit in integer EGP cents');
      }
      debitCents += line.debitCents;
      creditCents += line.creditCents;
      if (!Number.isSafeInteger(debitCents) || !Number.isSafeInteger(creditCents)) {
        throw new BadRequestException('Posting amount exceeds supported range');
      }
    }
    if (debitCents !== creditCents) {
      throw new BadRequestException('Journal debits and credits do not balance');
    }

    try {
      return await this.db.transaction(async (manager) => {
        const ids = [...new Set(event.lines.map((line) => line.accountId))];
        for (const id of ids) {
          const account = await manager.findOne(AccountingAccount, { where: { id } });
          if (!account) throw new NotFoundException(`Account ${id} was not found`);
          if (!account.isActive) throw new BadRequestException(`Account ${id} is inactive`);
          if ((account.currency || '').toUpperCase() !== 'EGP') {
            throw new BadRequestException(`Account ${id} must be an EGP account for this initial posting engine`);
          }
          if (await manager.exists(AccountingAccount, { where: { parentId: id } })) {
            throw new BadRequestException(`Account ${id} is a parent account and cannot receive postings`);
          }
        }
        const journal = manager.create(JournalEntry, {
          date: event.date,
          description: event.description.trim(),
          reference: event.reference?.trim() || undefined,
          type: event.type,
          postingStatus: 'posted',
          postedAt: new Date(),
          sourceEventKey: event.sourceEventKey.trim(),
          lines: event.lines.map((line) => {
            const amount = (line.debitCents - line.creditCents) / 100;
            return manager.create(JournalLine, {
              accountId: line.accountId,
              debit: line.debitCents / 100,
              credit: line.creditCents / 100,
              currency: 'EGP',
              exchangeRate: 1,
              amountBase: amount,
              amountEgp: amount,
            });
          }),
        });
        // Source-event uniqueness is enforced by PostgreSQL, including concurrent requests.
        return manager.save(JournalEntry, journal);
      });
    } catch (error) {
      if (error instanceof QueryFailedError &&
        (error.driverError as { code?: string } | undefined)?.code === '23505') {
        throw new ConflictException('This accounting event has already been posted');
      }
      throw error;
    }
  }
}
