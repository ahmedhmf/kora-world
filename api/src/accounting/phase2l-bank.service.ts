import {
  BadRequestException, ConflictException, ForbiddenException, Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { DataSource, EntityManager } from 'typeorm';
import { AccountingAccount, AccountType } from './entities/accounting-account.entity';
import { JournalEntry, JournalEntryType } from './entities/journal-entry.entity';
import { JournalLine } from './entities/journal-line.entity';

export interface BankRowInput {
  date: string;
  amountCents: number; // signed: bank inflow positive, outflow negative
  reference?: string;
  description?: string;
}
export interface ImportInput {
  accountId: number;
  statementKey: string;
  openingBalanceCents?: number | null;
  closingBalanceCents?: number | null;
  rows: BankRowInput[];
}
export interface OpeningInput {
  date: string;
  reference: string; // unique business identity, not an auto-generated retry key
  lines: Array<{ accountId: number; debitCents: number; creditCents: number }>;
}

const validDate = (date: string): boolean =>
  /^\d{4}-\d{2}-\d{2}$/.test(date || '') &&
  !Number.isNaN(Date.parse(date)) &&
  new Date(date).toISOString().slice(0, 10) === date;
const positiveId = (id: number) => Number.isSafeInteger(id) && id > 0;
const safeCents = (value: number) => Number.isSafeInteger(value) && Math.abs(value) <= 999999999999;
const amount = (cents: number) => cents / 100;

@Injectable()
export class Phase2LBankService {
  constructor(private readonly db: DataSource) {}

  private async gate(m: EntityManager) {
    if (process.env.ACCOUNTING_PHASE2L !== 'true' ||
        process.env.DATABASE_NAME !== 'kora_test' ||
        !['127.0.0.1', 'localhost', '::1'].includes(process.env.DATABASE_HOST || '127.0.0.1')) {
      throw new ForbiddenException('Phase 2L is disabled outside disposable local kora_test');
    }
    const [identity] = await m.query('SELECT current_database() AS name');
    if (identity?.name !== 'kora_test') {
      throw new ForbiddenException('Phase 2L actual database must be kora_test');
    }
  }

  private async account(m: EntityManager, id: number, cashOnly = false) {
    if (!positiveId(id)) throw new BadRequestException('Choose a valid account');
    const acc = await m.findOne(AccountingAccount, { where: { id } });
    if (!acc || !acc.isActive || acc.currency !== 'EGP' ||
        (cashOnly && (acc.type !== AccountType.ASSET || !acc.code.startsWith('11'))) ||
        await m.exists(AccountingAccount, { where: { parentId: id } })) {
      throw new BadRequestException('Select an active EGP leaf account; bank accounts must be 11xx assets');
    }
    return acc;
  }

  /**
   * Opening balances are not plugs: the administrator supplies each debit/
   * credit and must balance the entire entry. Posted only once per reference.
   * A reference must be reused on retries, and its payload must be identical.
   */
  async postOpening(input: OpeningInput, actorId: number) {
    if (!validDate(input?.date) ||
        !/^[A-Za-z0-9][A-Za-z0-9_-]{5,79}$/.test(input?.reference || '') ||
        !Array.isArray(input.lines) || input.lines.length < 2 ||
        input.lines.length > 100) {
      throw new BadRequestException('Valid opening date, unique reference (6–80 chars), and 2–100 lines required');
    }
    let debit = 0, credit = 0;
    const used = new Set<number>();
    for (const line of input.lines) {
      if (!positiveId(line.accountId) ||
          !safeCents(line.debitCents) || !safeCents(line.creditCents) ||
          line.debitCents < 0 || line.creditCents < 0 ||
          (line.debitCents > 0) === (line.creditCents > 0) ||
          used.has(line.accountId)) {
        throw new BadRequestException('Each distinct account must have exactly one positive debit OR credit in integer cents');
      }
      used.add(line.accountId);
      debit += line.debitCents;
      credit += line.creditCents;
    }
    if (!Number.isSafeInteger(debit) || !Number.isSafeInteger(credit) || debit <= 0 || debit !== credit) {
      throw new BadRequestException('Opening balances must have exactly equal debit and credit totals');
    }

    return this.db.transaction('SERIALIZABLE', async m => {
      await this.gate(m);
      // Serializes all opening attempts, including distinct references for the
      // same account. Locking avoids concurrent first-open double posting.
      await m.query('SELECT pg_advisory_xact_lock($1)', [20261202]);
      const key = `phase2l-opening:${input.reference}`;
      const found = await m.findOne(JournalEntry, {
        where: { sourceEventKey: key }, relations: { lines: true },
      });
      if (found) {
        const identical = found.date === input.date && found.postingStatus === 'posted' &&
          found.lines.length === input.lines.length &&
          input.lines.every(l => found.lines.some(j =>
            j.accountId === l.accountId &&
            Math.round(Number(j.debit) * 100) === l.debitCents &&
            Math.round(Number(j.credit) * 100) === l.creditCents));
        if (!identical) throw new ConflictException('Opening reference already exists with different details');
        return { journalId: found.id, replayed: true };
      }
      for (const l of input.lines) {
        const acc = await this.account(m, l.accountId);
        if (![AccountType.ASSET, AccountType.LIABILITY, AccountType.EQUITY].includes(acc.type)) {
          throw new BadRequestException('Opening lines may use asset, liability and equity accounts only');
        }
        // An opening balance must predate ALL journal activity for that account,
        // not merely earlier openings or previous fiscal years.
        const existing = await m.createQueryBuilder(JournalLine, 'line')
          .innerJoin(JournalEntry, 'entry', 'entry.id = line.journal_entry_id')
          .where('line.account_id = :accountId', { accountId: l.accountId })
          .andWhere("entry.posting_status IN ('posted','reversed')")
          .getCount();
        if (existing > 0) {
          throw new ConflictException(`Account ${acc.code} already has journal history. Do not backfill an opening entry into a used account; investigate and migrate separately.`);
        }
      }
      const row = await m.save(JournalEntry, m.create(JournalEntry, {
        date: input.date, type: JournalEntryType.MANUAL,
        description: '[Phase 2L opening balance] Verified historical opening balances',
        reference: input.reference, sourceEventKey: key,
        postingStatus: 'posted', postedAt: new Date(), createdById: actorId,
        approvedById: actorId,
        lines: input.lines.map(l => m.create(JournalLine, {
          accountId: l.accountId, debit: amount(l.debitCents),
          credit: amount(l.creditCents), amountBase: amount(l.debitCents - l.creditCents),
          amountEgp: amount(l.debitCents - l.creditCents), exchangeRate: 1, currency: 'EGP',
        })),
      }));
      return { journalId: row.id, replayed: false };
    });
  }

  async importStatement(input: ImportInput, actorId: number) {
    if (!positiveId(input?.accountId) ||
        !/^[A-Za-z0-9][A-Za-z0-9_.-]{3,119}$/.test(input?.statementKey || '') ||
        !Array.isArray(input.rows) || input.rows.length === 0 || input.rows.length > 500 ||
        (input.openingBalanceCents != null && !safeCents(input.openingBalanceCents)) ||
        (input.closingBalanceCents != null && !safeCents(input.closingBalanceCents))) {
      throw new BadRequestException('Import 1–500 EGP rows with a unique statement key and valid optional opening/closing cents');
    }
    for (const row of input.rows) {
      if (!validDate(row.date) || !safeCents(row.amountCents) || row.amountCents === 0 ||
          (row.reference?.length || 0) > 150 || (row.description?.length || 0) > 500) {
        throw new BadRequestException('Each row requires date and non-zero signed EGP cents; reference/description are length-limited');
      }
    }
    if (input.openingBalanceCents != null && input.closingBalanceCents != null) {
      const sum = input.rows.reduce((n, row) => n + row.amountCents, 0);
      if (!Number.isSafeInteger(sum) ||
          input.openingBalanceCents + sum !== input.closingBalanceCents) {
        throw new BadRequestException('Statement opening + signed rows must equal closing balance');
      }
    }

    return this.db.transaction('SERIALIZABLE', async m => {
      await this.gate(m);
      await this.account(m, input.accountId, true);
      const existing = await m.query(
        'SELECT id FROM accounting_bank_statement_imports WHERE account_id = $1 AND statement_key = $2',
        [input.accountId, input.statementKey],
      );
      if (existing.length) throw new ConflictException('Statement key already imported. Review the existing import rather than uploading again.');
      const fingerprints = input.rows.map(row => createHash('sha256')
        .update(JSON.stringify([input.accountId, row.date, row.amountCents,
          row.reference?.trim() || '', row.description?.trim() || ''])).digest('hex'));
      if (new Set(fingerprints).size !== fingerprints.length) {
        throw new ConflictException('Statement contains duplicate identical bank rows; investigate and supply distinct bank references before importing');
      }
      const [imported] = await m.query(`
        INSERT INTO accounting_bank_statement_imports
          (account_id, statement_key, currency, opening_balance_cents, closing_balance_cents, imported_by_id)
        VALUES ($1,$2,'EGP',$3,$4,$5) RETURNING id`,
        [input.accountId, input.statementKey, input.openingBalanceCents ?? null,
          input.closingBalanceCents ?? null, actorId]);
      for (let i = 0; i < input.rows.length; i++) {
        const row = input.rows[i];
        await m.query(`
          INSERT INTO accounting_bank_statement_rows
            (import_id, account_id, row_number, txn_date, reference, description, amount_cents, fingerprint)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [imported.id, input.accountId, i + 1, row.date, row.reference?.trim() || '',
            row.description?.trim() || '', row.amountCents, fingerprints[i]]);
      }
      await m.query(`
        INSERT INTO accounting_bank_reconciliation_events
          (import_id, action, actor_id, detail)
        VALUES ($1,'import',$2,$3)`,
        [imported.id, actorId, `Imported ${input.rows.length} signed EGP bank rows`]);
      return { importId: Number(imported.id), rowCount: input.rows.length };
    }).catch(e => {
      if (e?.code === '23505') throw new ConflictException('Duplicate bank row or statement key already exists; no rows imported');
      throw e;
    });
  }

  async list(accountId: number) {
    return this.db.transaction('REPEATABLE READ', async m => {
      await this.gate(m);
      await m.query('SET TRANSACTION READ ONLY');
      await this.account(m, accountId, true);
      const imports = await m.query(`
        SELECT id, account_id AS "accountId", statement_key AS "statementKey",
          opening_balance_cents::text AS "openingBalanceCents",
          closing_balance_cents::text AS "closingBalanceCents", imported_at AS "importedAt"
        FROM accounting_bank_statement_imports WHERE account_id=$1 ORDER BY id DESC`, [accountId]);
      const rows = await m.query(`
        SELECT r.id, r.import_id AS "importId", r.txn_date AS "date", r.reference,
          r.description, r.amount_cents::text AS "amountCents",
          r.matched_journal_line_id AS "matchedJournalLineId",
          r.matched_at AS "matchedAt", r.match_reason AS "matchReason"
        FROM accounting_bank_statement_rows r WHERE r.account_id=$1
        ORDER BY r.txn_date DESC, r.id DESC`, [accountId]);
      const events = await m.query(`
        SELECT e.id, e.action, e.actor_id AS "actorId", e.row_id AS "rowId",
          e.import_id AS "importId", e.journal_line_id AS "journalLineId",
          e.detail, e.created_at AS "createdAt"
        FROM accounting_bank_reconciliation_events e
        WHERE e.import_id IN (SELECT id FROM accounting_bank_statement_imports WHERE account_id=$1)
        ORDER BY e.id DESC LIMIT 500`, [accountId]);
      const candidates = await m.query(`
        SELECT l.id AS "lineId", j.id AS "journalId", j.date,
          j.description, j.reference,
          ROUND((l.debit - l.credit) * 100)::bigint::text AS "amountCents"
        FROM journal_lines l JOIN journal_entries j ON j.id=l.journal_entry_id
        LEFT JOIN accounting_bank_statement_rows r ON r.matched_journal_line_id=l.id
        WHERE l.account_id=$1 AND j.posting_status IN ('posted','reversed')
          AND r.id IS NULL
        ORDER BY j.date DESC, l.id DESC LIMIT 500`, [accountId]);
      return { imports, rows, events, candidates };
    });
  }

  async match(rowId: number, journalLineId: number, reason: string, actorId: number) {
    if (!positiveId(rowId) || !positiveId(journalLineId) ||
        !reason?.trim() || reason.trim().length > 500) {
      throw new BadRequestException('Select a valid bank row, posted journal line and 1–500 character match reason');
    }
    return this.db.transaction('SERIALIZABLE', async m => {
      await this.gate(m);
      const [row] = await m.query(`
        SELECT id, account_id AS "accountId", txn_date AS "date",
          amount_cents::text AS "amountCents",
          matched_journal_line_id AS "matchedJournalLineId"
        FROM accounting_bank_statement_rows WHERE id=$1 FOR UPDATE`, [rowId]);
      if (!row) throw new NotFoundException('Bank row not found');
      if (row.matchedJournalLineId != null) {
        throw new ConflictException('Bank row already matched; unmatch with an explicit reason before rematching');
      }
      const [line] = await m.query(`
        SELECT l.id, l.account_id AS "accountId", j.date,
          j.posting_status AS "postingStatus",
          ROUND((l.debit-l.credit)*100)::bigint::text AS "amountCents"
        FROM journal_lines l JOIN journal_entries j ON j.id=l.journal_entry_id
        WHERE l.id=$1`, [journalLineId]);
      if (!line || line.accountId !== row.accountId ||
          !['posted', 'reversed'].includes(line.postingStatus) ||
          line.amountCents !== row.amountCents ||
          String(line.date).slice(0, 10) !== String(row.date).slice(0, 10)) {
        throw new ConflictException('Match requires same bank account, signed amount and date in a posted/reversed journal');
      }
      const result = await m.query(`
        UPDATE accounting_bank_statement_rows
        SET matched_journal_line_id=$2, matched_by_id=$3, matched_at=now(), match_reason=$4
        WHERE id=$1 AND matched_journal_line_id IS NULL RETURNING id`,
        [rowId, journalLineId, actorId, reason.trim()]);
      if (!result.length) throw new ConflictException('Bank row was matched by another request');
      await m.query(`
        INSERT INTO accounting_bank_reconciliation_events
          (row_id, import_id, action, actor_id, journal_line_id, detail)
        VALUES ($1, (SELECT import_id FROM accounting_bank_statement_rows WHERE id=$1),
          'match',$2,$3,$4)`, [rowId, actorId, journalLineId, reason.trim()]);
      return { rowId, journalLineId, matched: true };
    }).catch(e => {
      if (e?.code === '23505') throw new ConflictException('That journal line is already matched to another bank row');
      throw e;
    });
  }

  async unmatch(rowId: number, reason: string, actorId: number) {
    if (!positiveId(rowId) || !reason?.trim() || reason.trim().length > 500) {
      throw new BadRequestException('Bank row and an explanation are required');
    }
    return this.db.transaction('SERIALIZABLE', async m => {
      await this.gate(m);
      const [row] = await m.query(`
        SELECT id, import_id AS "importId", matched_journal_line_id AS "journalLineId"
        FROM accounting_bank_statement_rows WHERE id=$1 FOR UPDATE`, [rowId]);
      if (!row) throw new NotFoundException('Bank row not found');
      if (!row.journalLineId) throw new ConflictException('Bank row is not currently matched');
      await m.query(`
        UPDATE accounting_bank_statement_rows
        SET matched_journal_line_id=NULL, matched_by_id=NULL, matched_at=NULL, match_reason=NULL
        WHERE id=$1`, [rowId]);
      await m.query(`
        INSERT INTO accounting_bank_reconciliation_events
          (row_id, import_id, action, actor_id, journal_line_id, detail)
        VALUES ($1,$2,'unmatch',$3,$4,$5)`,
        [rowId, row.importId, actorId, row.journalLineId, reason.trim()]);
      return { rowId, unmatched: true };
    });
  }
}
