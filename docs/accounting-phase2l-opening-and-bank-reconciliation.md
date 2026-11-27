# Phase 2L — Opening balances, bank statement import, matching and audit

**Status:** Code committed on `feature/accounting-redesign`. Local build, Jest and PostgreSQL integration tests **not yet run by the assistant**. No production changes or authorization to deploy.

## Modules implemented together

### 2L-A — Opening balances

- Admin-only `POST /accounting/phase2l/opening`.
- EGP asset/liability/equity active **leaf** accounts only, with date and unique business reference.
- Signed debit/credit input in exact integer EGP cents, equal positive debits/credits, no duplicate account IDs.
- One atomic, balanced, posted manual journal with source key `phase2l-opening:<reference>`.
- Retrying the exact same reference and payload returns the original journal ID; conflicting payload is rejected.
- Concurrent first-opening submissions serialize through a transaction-scoped advisory lock.
- **Account history protection:** refuses posting an opening balance to any account already containing journal lines, including drafts and pending-approval entries. This is intentional: the existing Marketing example has an already-used bank account. Opening balances for that historic account require a separately audited backfill/migration plan, not arbitrary backdating through this pilot form.
- No automatic balancing plug entries are made.

### 2L-B — EGP bank statement import

- Admin-only `POST /accounting/phase2l/statements`.
- CSV format must be UTF-8, **comma-delimited**, with exact header:

```csv
date,amount,reference,description
2026-11-27,-2345.00,MARKETING-001,Marketing payment
```

- Imported bank outflows are **negative**, inflows **positive**. ISO date YYYY-MM-DD; exactly two decimal places; no currency symbols or thousand separators.
- Select bank/cash asset account code `11xx`; account must be active, leaf and EGP.
- 1–500 rows; optional statement opening and closing balances in EGP. When both are supplied, `opening + sum(signed transactions) = closing` must hold.
- A unique `statementKey` identifies a statement per bank account.
- Identical canonical bank rows are rejected by unique SHA256 fingerprint per account, including across imports. This is intentionally conservative and may reject genuinely repeated indistinguishable bank transactions. Resolve with the bank provider's unique transaction reference; never invent IDs.
- The import creates **only bank staging rows**, never journals, invoices or payments.
- Raw statement attachments are not stored by this phase; the rows, references, importing actor and import time are retained. Store original statement evidence separately under your organization's records policy.

### 2L-C — Controlled exact bank-to-journal matching

- Admin-only `POST /accounting/phase2l/rows/:id/match` with `journalLineId`, explicit reason.
- The selected journal line must be from a posted or reversed journal, and the account, transaction date and **signed amount** must match the staged bank row exactly. Only EGP journal lines with exchange rate 1 and a consistent stored EGP base amount are accepted.
- Each bank row and journal line can be matched **at most once**, enforced in PostgreSQL.
- Mismatch, duplicate or unsupported currency cannot silently auto-post a transaction. Matching is a linkage only, **not** a payment.
- `POST /accounting/phase2l/rows/:id/unmatch` requires reason; the former journal-line ID and explanation remain in audit history.
- No automatic fuzzy matching, suggestions based on descriptions alone, or allocations for one bank row covering multiple journal lines are enabled.

### 2L-D — Reconciliation history and balance comparison

- `GET /accounting/phase2l/statements?accountId=<id>` available to admin/accountant, read-only.
- Shows original imports, imported rows, exact same-day/same-account/signed-amount candidates, matched row status, actor + timestamps + reason for match/unmatch, and latest 500 historical events.
- Compares each statement's optional closing amount against the **posted ledger balance** for the selected bank account as of the statement's final transaction date.
- Displays explicit variance (`statement closing - journal ledger` in EGP), number of matched rows, and number unmatched.
- A `0.00` variance does **not** prove every transaction has been checked or that the bank statement is genuine. Review all rows and complete bank evidence verification manually.
- No journal or payment history is deleted or adjusted by matching or unmatching.

## Local safety controls

All Phase 2L service calls require:
- `ACCOUNTING_PHASE2L=true`;
- configured `DATABASE_NAME=kora_test`, loopback `DATABASE_HOST`;
- a SQL check that `current_database() = 'kora_test'` **inside the same transaction**.
- Admin JWT role for any write; admin/accountant for report reads.

New staging and immutable event tables are created by
`api/src/migrations/1764300000000-Phase2LBankReconciliation.ts`.
**Migration guards:** `up` and `down` only modify tables if actual PostgreSQL database identity equals `kora_test`. In any other database, this migration is a no-op. Any eventual production rollout needs an explicitly reviewed and approved replacement migration.

The Angular menu is **Accounting → Bank Reconciliation**, route
`/accounting/bank-reconciliation`, visible to local admins.

**EUR/USD:** This pilot is EGP only and does not modify, convert or automatically revalue manually entered foreign-currency transactions.

## Local commands

Pull and compile on the development branch:

```powershell
cd D:\Ahmed\project\kora-world
git pull --ff-only origin feature/accounting-redesign

cd api
npm run build
npm test -- --runInBand phase2l-bank.service.spec.ts phase2j-report.policy.spec.ts

cd ..\web
npm run build
```

To initialize the **local disposable kora_test only**, after verifying connection settings, start the backend once. Nest's existing TypeORM configuration has `migrationsRun: true` and will apply the new local-only staging migration:

```powershell
cd D:\Ahmed\project\kora-world\api
$env:DATABASE_NAME = 'kora_test'
$env:DATABASE_HOST = '127.0.0.1'
$env:ACCOUNTING_PHASE2L = 'true'
npm run start:dev
```

Then check actual connected database identity using your PostgreSQL client and confirm the three tables exist:
`accounting_bank_statement_imports`,
`accounting_bank_statement_rows`,
`accounting_bank_reconciliation_events`.

Run the real PostgreSQL integration test from a separate PowerShell terminal, again using **only disposable local kora_test**:

```powershell
cd D:\Ahmed\project\kora-world\api
$env:DATABASE_NAME = 'kora_test'
$env:DATABASE_HOST = '127.0.0.1'
npm run test:accounting:integration -- phase2l-bank.integration.ts
```

The integration test creates unique, disposable EGP bank/equity accounts; posts a balanced opening, creates a test Marketing expense journal, imports a matching statement, verifies zero variance, matches and unmatches once, checks persistent audit history, and deletes **only its own records**. The disposable `kora_test` chart of accounts must already have an active leaf EGP Marketing expense account `5300`.

## Acceptance checklist

1. Confirm `npm run build` for API and Angular and all unit tests pass.
2. Confirm the local database migration and PostgreSQL integration test pass.
3. In local admin Angular, open Bank Reconciliation and create a balanced opening for **new unused test accounts**, then submit twice with the same reference. The second request returns a replay; a different opening for those already-used accounts is rejected.
4. Import a bank CSV with a known statement key; verify original import, staged rows, totals and no new journal from import.
5. Select a row with an existing exact journal-line candidate; confirm match and audit event. Attempt duplicate match and confirm rejection.
6. Unmatch with a reason and confirm immutable audit entry and available journal line.
7. Compare bank statement closing to actual ledger. A missing opening or unmatched historical posting should remain visible as a variance.
8. Confirm disabled flag, production DB name, wrong actual DB and non-admin JWT all refuse requests.
9. Do not deploy Phase 2L until the standalone local tests and accounting review have passed.

## Deliberate limitations and next safeguards

- This pilot does not offer automatic bank transaction creation, automated rule matching, multi-line allocations, multi-currency statements, OFX/PDF statement import, or real-bank connectivity.
- Opening balances on an account that already has recorded history require a separate reviewed historical transition workflow. Do not reverse a legitimate Marketing expense merely to make opening balances fit.
- The read-only bank transaction matching list shows the latest 500 eligible journal candidates; a very old matching candidate may not appear until a future pagination/search upgrade.
- The event trail is append-only through application endpoints, but PostgreSQL superusers can alter data. Production readiness requires database-level roles/auditing and policy-controlled exports.
