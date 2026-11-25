# Phase 2I Part 2 — Read-only invoice/payment/journal reconciliation audit

**Branch:** `feature/accounting-redesign`.
**Status:** Implemented, awaiting local build and test verification. **Not deployed.**

## What this change adds

An opt-in, **admin-only** diagnostic:

`GET /accounting/reconciliation-audit`

- The endpoint is disabled by default.
- It requires `ACCOUNTING_RECONCILIATION_AUDIT=true`, `DATABASE_NAME=kora_test`, and a loopback `DATABASE_HOST`.
- It verifies `SELECT current_database()` equals `kora_test` inside a `REPEATABLE READ` transaction, then executes `SET TRANSACTION READ ONLY`.
- It reads invoices, payment rows, and journal entries as one snapshot. It does **not** modify records, perform migrations, or repair history.
- It returns invoice IDs and document numbers, booking/payment/reversal journal IDs, payment IDs, and issue classifications. Output can contain sensitive accounting details; treat the response as private.
- It also returns payment records without a valid invoice link and payment journals without a valid invoice link.

The classifier identifies:
- Missing or multiple invoice-booking journals.
- Synthetic invoice-status-generated payment journals (references like `<invoice-number>-PAY`).
- Unmatched payment rows or payment journal entries.
- Duplicate payment references and payment journal linkage.
- Orphaned, duplicate or inconsistent reversal history.
- Paid invoices with no payment record; flagged EGP amount/status mismatch.
- EUR/USD and mixed currencies requiring **manual review**. It never converts money or assumes an exchange rate.

## Limitations (important)

This is a **conservative diagnostic**, not proof that the books are correct. A matching reference alone does **not** prove bank settlement. Legacy journal reference reuse and historic partial payments can produce warnings that need human investigation. An invoice marked clean is only structurally clear under the implemented checks; it is not an external bank reconciliation.

No changes are made to the legacy journal generation or posting workflows in this increment. Those still need a separate, tested transactional cutover. The source of truth must first be established by reviewing the audit results.

## Run locally (disposable test DB only)

```powershell
cd D:\Ahmed\project\kora-world
git pull --ff-only origin feature/accounting-redesign
cd api
npm run build
npm test -- --runInBand invoice-payment-reconciliation.spec.ts invoice-payment-reconciliation.service.spec.ts
```

Only after verifying your local database is disposable `kora_test`, start a local API shell with:

```powershell
$env:DATABASE_NAME = 'kora_test'
$env:DATABASE_HOST = '127.0.0.1'
$env:ACCOUNTING_RECONCILIATION_AUDIT = 'true'
npm run start:dev
```

Sign in to your **local** app as an admin, then call `GET http://localhost:3000/accounting/reconciliation-audit` from your authenticated browser session or API client. The result is JSON; store it securely. Leave the audit flag **unset** in production and other environments.

**Do not run against `kora_world`**. The API and test database must not contain production financial data. Do not start a local backend with test settings unless you've verified the actual connection target and migrations configuration.

## Next cutover milestone

After reviewing flagged records, design a controlled, transactional payment posting and invoice-status update on `kora_test`. Implement it for an explicitly identified invoice class, add rollback/idempotency/concurrency tests, and only later plan an authorized production migration. Historical journals must be preserved, never deleted or automatically rewritten.

Automatic FX (former Phase 2K) remains excluded; manual foreign-currency workflows remain unchanged.
