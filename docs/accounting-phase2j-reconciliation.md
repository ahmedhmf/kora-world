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

# Real PostgreSQL integration checks (only disposable local kora_test)
cd ..\api
$env:DATABASE_NAME = 'kora_test'
$env:DATABASE_HOST = '127.0.0.1'
npm run test:accounting:integration -- phase2j-report.integration.ts

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


## Database integration tests

`api/src/accounting/phase2j-report.integration.ts` adds **two PostgreSQL integration tests** using a unique disposable supplier invoice, a payment and controlled posted journal:
1. Verifies AP outstanding balance plus period expense/cash-flow coverage from the read-only reporting endpoint.
2. Posts a fixture reversal, checks the full outstanding amount is restored and the original payment remains, and checks an earlier as-of report still counts the payment before the reversal.

The fixture is removed by its own invoice and bank account IDs, with reversal journals removed before their originals. Integration tests have **not** been executed in the local PostgreSQL runtime by the assistant.

## Review limitations

- This report does not claim to make legacy accounting history clean. Ambiguous legacy payments or synthetic journals require manual investigation. Unverified invoice balances are null and excluded from the verified total.
- A balance sheet can remain imbalanced if closing entries have not transferred revenue/expense into equity. This preview reports the difference rather than inventing an entry.
- Cash Flow is a journal-based view of 11-prefix asset account movements, not an independently verified cash-flow classification or bank reconciliation.
- `asOfDate` determines snapshot cutoffs for invoice/payment settlement and ledger balances. The reporting time window governs Profit & Loss and Cash Flow.
- Non-EGP source entries appear in financial statement base-amount totals exactly as recorded, with explicit manual-review flags. Their correctness must be verified manually; the report does not infer or substitute rates.


## Phase 2J-E — Balance Sheet current-year and prior unclosed earnings

**Purpose:** Remove the false `balance_sheet_difference` warning for legitimate Money Out expense and Money In revenue postings while retaining warnings for real mismatches.

The Balance Sheet now presents these independent **EGP** figures as of `asOfDate`:

- `totalEquity`: equity accounts already posted to the ledger, unchanged.
- `currentYearEarnings`: net unclosed revenue minus expenses posted from January 1 of the as-of year through the as-of date.
- `priorUnclosedEarnings`: net unclosed nominal-account balances from before January 1 of the as-of year. This is shown separately to avoid silently calling old unclosed income current-year earnings.
- `unclosedEarnings`: sum of the two earnings components.
- `adjustedEquity`: posted equity plus all unclosed earnings, **presentation only**.
- `difference`: assets minus liabilities minus adjusted equity.
- `isBalanced`: true if absolute adjusted difference is no greater than EGP 0.02.

The source is the **same** existing set of posted or reversed journal lines used by Phase 2J financial statements. Draft/pending journals are ignored; an original reversed journal and its posted reversing journal remain represented. A true closing journal that zeros the nominal-account balances removes the corresponding unclosed earnings naturally, preventing double-counting. No SQL writes, closing journals, transaction amendments, exchange-rate calculations, or database migrations were added.

The **selected Profit & Loss period** continues to determine the displayed P&L income; Balance Sheet earnings are computed independently from the January 1 calendar-year boundary through `asOfDate`, with earlier unclosed amounts disclosed separately. The result may therefore differ from the net profit in a short date range.

For the verified local screenshot scenario (Marketing Money Out, EGP 2,345, no other entries), expected figures are assets `-2,345.00`, liabilities `0.00`, posted equity `0.00`, current-year earnings `-2,345.00`, adjusted equity `-2,345.00`, adjusted difference `0.00`. **A negative cash/bank balance still requires funding/opening-balance investigation.**

The implementation updates the Phase 2J report type, financial reports preview, and reconciliation dashboard summary. The old production-facing `GET /accounting/reports/balance-sheet` is intentionally **unchanged**.

Regression tests in `phase2j-report.policy.spec.ts` cover:
- Single Marketing Money Out and Cash Flow consistency.
- Single Money In revenue.
- Earnings calculated independently of a shorter P&L date range.
- Prior-year unclosed earnings shown separately.
- Proper journal-closing entries that move earnings to posted equity.
- Truly unbalanced journals still showing `balance_sheet_difference`.

Run:
```powershell
cd D:\Ahmed\project\kora-world
git pull --ff-only origin feature/accounting-redesign
cd api
npm run build
npm test -- --runInBand phase2j-report.policy.spec.ts phase2j-report.service.spec.ts

cd ..\web
npm run build
```

**Status:** Committed; the assistant has not executed a local TypeScript build, Jest run, or PostgreSQL/browser check. Confirm the tests and refresh the Phase 2J Reconciliation tab and dashboard on local `kora_test` before treating this reporting calculation as validated.
