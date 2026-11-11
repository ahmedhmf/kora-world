import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { AccountingAccount } from './entities/accounting-account.entity';
import { JournalEntry, JournalEntryType } from './entities/journal-entry.entity';
import { JournalLine } from './entities/journal-line.entity';
import { PostAccountingEvent, PostingLine } from './accounting-posting.service';

/**
 * Isolated manual-journal workflow. Existing invoice/payment services are
 * NOT routed through this service yet.
 *
 * Monetary scope: EGP only, exact integer cents at the API boundary.
 * Maker-checker: the creator cannot approve their own journal.
 */
@Injectable()
export class JournalWorkflowService {
  constructor(private readonly db: DataSource) {}

  private async actor(m: EntityManager, userId: number, mustBeAccountant = false): Promise<User> {
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      throw new ForbiddenException('Authenticated user required');
    }
    const user = await m.findOne(User, { where: { id: userId } });
    if (!user) throw new ForbiddenException('User no longer exists');
    if (mustBeAccountant && !['accountant', 'admin'].includes(user.role)) {
      throw new ForbiddenException('Only accountants or administrators may perform this action');
    }
    return user;
  }

  private validate(event: PostAccountingEvent): void {
    if (event.type !== JournalEntryType.MANUAL) {
      throw new BadRequestException('This workflow accepts manual journals only');
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(event.date) ||
      Number.isNaN(Date.parse(event.date)) ||
      new Date(event.date).toISOString().slice(0, 10) !== event.date) {
      throw new BadRequestException('Invalid journal date');
    }
    if (!event.description?.trim()) throw new BadRequestException('Description required');
    if ((event.reference?.length || 0) > 100) throw new BadRequestException('Reference too long');
    if (!Array.isArray(event.lines) || event.lines.length < 2) {
      throw new BadRequestException('At least two journal lines required');
    }
    let debits = 0;
    let credits = 0;
    for (const l of event.lines) {
      if (!Number.isSafeInteger(l.accountId) || l.accountId <= 0 ||
        !Number.isSafeInteger(l.debitCents) || !Number.isSafeInteger(l.creditCents) ||
        l.debitCents < 0 || l.creditCents < 0 ||
        (l.debitCents > 0) === (l.creditCents > 0)) {
        throw new BadRequestException('Each line must contain one positive debit or credit in integer cents');
      }
      debits += l.debitCents;
      credits += l.creditCents;
      if (!Number.isSafeInteger(debits) || !Number.isSafeInteger(credits)) {
        throw new BadRequestException('Amount exceeds supported range');
      }
    }
    if (debits !== credits) throw new BadRequestException('Journal must balance in EGP cents');
  }

  private async checkAccounts(m: EntityManager, lines: PostingLine[]): Promise<void> {
    for (const id of new Set(lines.map((l) => l.accountId))) {
      const account = await m.findOne(AccountingAccount, { where: { id } });
      if (!account) throw new NotFoundException(`Accounting account ${id} not found`);
      if (!account.isActive || account.currency.toUpperCase() !== 'EGP') {
        throw new BadRequestException(`Accounting account ${id} is inactive or not an EGP account`);
      }
      if (await m.exists(AccountingAccount, { where: { parentId: id } })) {
        throw new BadRequestException(`Cannot post to parent accounting account ${id}`);
      }
    }
  }

  private async lockedJournal(m: EntityManager, id: number): Promise<JournalEntry> {
    if (!Number.isSafeInteger(id) || id <= 0) throw new BadRequestException('Invalid journal ID');
    const journal = await m.findOne(JournalEntry, {
      where: { id }, lock: { mode: 'pessimistic_write' },
    });
    if (!journal) throw new NotFoundException('Journal not found');
    return journal;
  }

  async listVisible(userId: number): Promise<JournalEntry[]> {
    const actor = await this.actor(this.db.manager, userId);
    const privileged = ['accountant', 'admin'].includes(actor.role);
    return this.db.getRepository(JournalEntry).find({
      ...(privileged ? {} : {
        where: [
          { createdById: userId },
          { postingStatus: In(['posted', 'reversed']) },
        ],
      }),
      relations: { lines: { account: true } },
      order: { date: 'DESC', createdAt: 'DESC', id: 'DESC' },
    });
  }

  async getVisible(id: number, userId: number): Promise<JournalEntry> {
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new BadRequestException('Invalid journal ID');
    }
    const actor = await this.actor(this.db.manager, userId);
    const journal = await this.db.getRepository(JournalEntry).findOne({
      where: { id },
      relations: { lines: { account: true } },
    });
    if (!journal) throw new NotFoundException('Journal not found');
    const canView = ['accountant', 'admin'].includes(actor.role) ||
      journal.createdById === userId ||
      ['posted', 'reversed'].includes(journal.postingStatus);
    if (!canView) throw new NotFoundException('Journal not found');
    return journal;
  }

  async createDraft(event: Omit<PostAccountingEvent, 'sourceEventKey' | 'type'>, userId: number) {
    this.validate({ ...event, sourceEventKey: '', type: JournalEntryType.MANUAL });
    return this.db.transaction(async (m) => {
      await this.actor(m, userId);
      await this.checkAccounts(m, event.lines);
      return m.save(JournalEntry, m.create(JournalEntry, {
        date: event.date,
        description: event.description.trim(),
        reference: event.reference?.trim() || undefined,
        type: JournalEntryType.MANUAL,
        postingStatus: 'draft',
        createdById: userId,
        lines: event.lines.map((line) => {
          const amount = (line.debitCents - line.creditCents) / 100;
          return m.create(JournalLine, {
            accountId: line.accountId,
            debit: line.debitCents / 100,
            credit: line.creditCents / 100,
            amountBase: amount,
            amountEgp: amount,
            exchangeRate: 1,
            currency: 'EGP',
          });
        }),
      }));
    });
  }

  async submit(id: number, userId: number) {
    return this.db.transaction(async (m) => {
      const actor = await this.actor(m, userId);
      const journal = await this.lockedJournal(m, id);
      if (journal.type !== JournalEntryType.MANUAL || journal.postingStatus !== 'draft') {
        throw new BadRequestException('Only draft manual journals can be submitted');
      }
      if (actor.role !== 'admin' && journal.createdById !== userId) {
        throw new ForbiddenException('Only the draft creator or an administrator can submit it');
      }
      journal.postingStatus = 'pending_approval';
      journal.submittedById = userId;
      journal.submittedAt = new Date();
      return m.save(JournalEntry, journal);
    });
  }

  async approveAndPost(id: number, userId: number) {
    return this.db.transaction(async (m) => {
      const actor = await this.actor(m, userId, true);
      const journal = await this.lockedJournal(m, id);
      if (journal.type !== JournalEntryType.MANUAL || journal.postingStatus !== 'pending_approval') {
        throw new BadRequestException('Journal is not awaiting approval');
      }
      // Administrators may perform any workflow action; accountants retain maker-checker separation.
      if (actor.role !== 'admin' && (journal.createdById === userId || journal.submittedById === userId)) {
        throw new ForbiddenException('Accountants cannot approve a journal they created or submitted');
      }
      const lines = await m.find(JournalLine, { where: { journalEntryId: id }, order: { id: 'ASC' } });
      const cents = (value: number) => {
        const n = Number(value) * 100;
        if (!Number.isSafeInteger(Math.round(n)) || Math.abs(n - Math.round(n)) > 0.000001) {
          throw new BadRequestException('Journal contains invalid precision');
        }
        return Math.round(n);
      };
      const inputs = lines.map((line) => ({
        accountId: line.accountId,
        debitCents: cents(line.debit),
        creditCents: cents(line.credit),
      }));
      this.validate({
        sourceEventKey: '',
        date: String(journal.date).slice(0, 10),
        description: journal.description || '',
        reference: journal.reference,
        type: JournalEntryType.MANUAL,
        lines: inputs,
      });
      if (lines.some(l => l.currency !== 'EGP' || Number(l.exchangeRate) !== 1 ||
        cents(l.amountBase) !== cents(l.debit) - cents(l.credit))) {
        throw new BadRequestException('Unsupported currency or journal base-amount mismatch');
      }
      await this.checkAccounts(m, inputs);
      journal.postingStatus = 'posted';
      journal.postedAt = new Date();
      journal.approvedById = userId;
      journal.sourceEventKey = `manual:journal:${id}:posted:v1`;
      return m.save(JournalEntry, journal);
    });
  }

  async reverse(id: number, userId: number, reason: string) {
    if (!reason?.trim() || reason.trim().length > 500) {
      throw new BadRequestException('A reversal reason (up to 500 characters) is required');
    }
    return this.db.transaction(async (m) => {
      await this.actor(m, userId, true);
      const journal = await this.lockedJournal(m, id);
      if (journal.type !== JournalEntryType.MANUAL || journal.postingStatus !== 'posted') {
        throw new BadRequestException('Only posted manual journals can be reversed here');
      }
      // Lock the original; the unique reversal_of_id index prevents a second reversal too.
      const existing = await m.findOne(JournalEntry, { where: { reversalOfId: id } });
      if (existing) throw new BadRequestException('Journal was already reversed');
      const lines = await m.find(JournalLine, { where: { journalEntryId: id } });
      if (!lines.length || lines.some(l => l.currency !== 'EGP' || Number(l.exchangeRate) !== 1)) {
        throw new BadRequestException('This reversal workflow supports EGP journals only');
      }
      const now = new Date();
      const reversal = m.create(JournalEntry, {
        date: now.toISOString().slice(0, 10),
        description: `Reversal of #${id}: ${reason.trim()}`,
        reference: `REV-${id}`,
        type: JournalEntryType.MANUAL,
        postingStatus: 'posted',
        createdById: userId,
        approvedById: userId,
        postedAt: now,
        reversalOfId: id,
        sourceEventKey: `manual:journal:${id}:reversal:v1`,
        lines: lines.map((l) => m.create(JournalLine, {
          accountId: l.accountId,
          debit: l.credit,
          credit: l.debit,
          currency: 'EGP',
          exchangeRate: 1,
          amountBase: -Number(l.amountBase),
          amountEgp: -Number(l.amountEgp),
        })),
      });
      const created = await m.save(JournalEntry, reversal);
      journal.postingStatus = 'reversed';
      journal.reversedById = userId;
      journal.reversedAt = now;
      await m.save(JournalEntry, journal);
      return created;
    });
  }
}
