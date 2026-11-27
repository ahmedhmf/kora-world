# Phase 2J — AP, AR and financial statement reconciliation (local test pilot)

**Status:** Implementation and unit tests committed on `feature/accounting-redesign`. **Local compilation, actual PostgreSQL checks and browser verification still required.** No production changes.

## What is implemented

Phase 2J provides a **new, separate, read-only** reporting route rather than silently changing the production-facing legacy reports:

`GET /accounting/phase2j-report?startDate=2026-01-01&endDate=2026-12-31&asOfDate=2026-12-31`

Available to authenticated admin/accountant users only. All three ISO dates are required, with `startDate <= endDate <= asOfDate`.

It returns one snapshot with:
- **Accounts Payable:** invoice-level total, verified active supplier settlements, reversed settlements, outstanding balances, and per-invoice warnings.
- **Accounts Receivable:** invoice-level balances; legacy unlinked customer payments are flagged for manual review and **not** treated as verified.
- **Profit & Loss:** revenue, expenses, gross/net profit from persisted EGP base line values for the requested period.
- **Balance Sheet:** assets, liabilities, posted equity, and a difference indicator as of the requested date. No fictitious equity/retained-earnings journal is generated to force balancing.
- **Cash Flow:** debit/credit movements on asset accounts with 11-prefix bank/cash codes for the selected period (a cash-movement preview, not a bank statement match).
- A structured `issues` array identifying missing/unbalanced journals, reversal inconsistencies, account/link errors, manual currency-review items and unclosed balance-sheet differences.

Only journals in **posted or reversed** status affect the statement ledger. A reversed original's effect is retained alongside its posted **opposite reversal journal**, so they cancel correctly. Draft and pending-approval journals are excluded. Invoice settlement totals are calculated in integer cents from **verified source-event-linked payments**, not by merely summing every historical Payment row.

Report rows with ambiguous history have `paid`, `reversed`, and `outstanding` set to **null** and are **excluded** from the verified EGP outstanding subtotal, with a visible review counter. An absent warning is structural verification, not external confirmation that money moved at the bank.

The output uses already-stored EGP `amountBase` in journal lines. Non-EGP source line entries and invoices are **flagged for manual FX valuation**. No automatic exchange rates, new FX entries, conversion fallbacks, or periodic revaluation have been added. Existing EUR/USD records and routes remain untouched.

## Isolation guarantees

The new endpoint is disabled unless all conditions hold:
- `ACCOUNTING_PHASE2J_REPORT=true`;
- configured `DATABASE_NAME=kora_test`, `DATABASE_HOST` loopback;
- inside the transaction, PostgreSQL confirms `current_database()='kora_test'`;
- transaction is `REPEATABLE READ` and explicitly `SET TRANSACTION READ ONLY`.

The original routes `/accounting/reports/profit-loss`, `/balance-sheet`, `/cash-flow`, `/accounts-payable`, `/accounts-receivable` have **not been replaced or migrated**. The Phase 2J UI is a local-only additional tab named **Phase 2J Reconciliation**.

**This is a preview/reconciliation layer, not production-certified accounting statements.** Remaining follow-ups before any production deployment: real PostgreSQL fixture/integration verification, comparison of legacy history, reconciliation with bank statements, manually approved FX valuations, testing on known datasets and written financial signoff.

## Run checks

```powershell
cd D:\Ahmed\project\kora-world
git pull --ff-only origin feature/accounting-redesign

cd api
npm run build
npm test -- --runInBand phase2j-report.policy.spec.ts phase2j-report.service.spec.ts reports.service.spec.ts

cd ..\web
npm run build
```

To view the report, **only after confirming the backend connects to a disposable local kora_test**:

```powershell
cd D:\Ahmed\project\kora-world\api
$env:DATABASE_NAME = 'kora_test'
$env:DATABASE_HOST = '127.0.0.1'
$env:ACCOUNTING_PHASE2J_REPORT = 'true'
npm run start:dev
```

Sign in to localhost as an admin/accountant, open Accounting → Reports → Phase 2J Reconciliation, select period and as-of dates, click **Generate Report**, and review the warning list and excluded invoice counts.

Do **not** set this flag on production. Do not modify production reports or migrate historical data until the preview is reconciled and approved.
