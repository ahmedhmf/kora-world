# Supplier Payments — Phase 2G: Reversal-aware balances and history (local pilot)

**Branch:** `feature/accounting-redesign`
**Status:** Implemented, awaiting local build and tests. **No production changes, migrations, or activation.**

## Why this is separate

The existing `ReportsService.getAccountsPayable` fetches all payment rows and totals their amounts without excluding reversed settlement journals. Updating it globally before carefully reviewing legacy EUR/USD payments, invoice statuses and historic posting could misstate finance totals.

Phase 2G therefore introduces **read-only, authenticated, test-only endpoints** for supplier EGP pilot data. It does not alter the original Accounts Payable, Receivable, Cash Flow, Balance Sheet, or Profit & Loss endpoints.

## New pilot read endpoints

- `GET /payments/supplier-egp-pilot/invoices/:id/balance`
  - Invoice total, effective paid amount, reversed amount and outstanding amount in **integer EGP cents**.
  - Complete payment history: reference, date, original journal ID, status (`active` or `reversed`), reversal journal ID, actor user ID, timestamp, and reason.
  - Example: an EGP 1,000 invoice with a reversed EGP 400 payment and active EGP 200 and EGP 300 payments reports paid 50,000 cents, reversed 40,000 cents, outstanding 50,000 cents.
- `GET /payments/supplier-egp-pilot/accounts-payable`
  - Aggregates these same validated balances across invoices that have at least one payment with a non-null test-pilot `request_key`.
  - Returns invoiceCount, totalCents, paidCents, reversedCents, outstandingCents and individual invoice details.
  - **Pilot invoices only.** It intentionally does *not* claim to report the full company Accounts Payable ledger.

Both endpoints:
- Require a valid authenticated session and an accountant/admin role.
- Fail closed unless `SUPPLIER_EGP_PILOT=true`, local `kora_test` configuration, and a transaction-scoped check confirming the actual database is `kora_test`.
- Use `REPEATABLE READ` and `SET TRANSACTION READ ONLY`. They never write finance records.
- Reuse the same strict payment/journal match and reversal-history checks as the pilot's create and reverse paths; inconsistent or legacy history raises a conflict instead of silently guessing totals.
- Do not add an FX conversion or production migrations.

## Important accounting semantics

Effective paid is the sum of **active original supplier settlement journals** linked one-to-one to payment rows. A reversed payment and its opposite journal remain in history; the reversed amount is displayed separately but excluded from effective paid. Outstanding = invoice total - effective paid, all in EGP cents.

The report is a **current-state operational balance**, not a historical `asOfDate` accounting report or a ledger trial balance. Reversal date determines when the opposite journal affects ledger balances; this report always reflects the latest validated state.

## Local verification

```powershell
cd D:\Ahmed\project\kora-world
git pull --ff-only origin feature/accounting-redesign
cd api
npm run build
npm test -- --runInBand supplier-egp-pilot.service.spec.ts supplier-settlement.policy.spec.ts payments.service.spec.ts

# PostgreSQL integration requires disposable local kora_test with previously
# prepared payments.request_key unique index and EGP AP account 2100.
$env:DATABASE_NAME = "kora_test"
$env:DATABASE_HOST = "127.0.0.1"
npm run test:accounting:integration -- supplier-egp-pilot.integration.ts
```

Do **not** enable `SUPPLIER_EGP_PILOT` in the main API environment. The test suite turns it on within Jest and restores it afterward. It creates disposable fixtures, then attempts fixture cleanup.

## Existing reporting concerns / next decisions

1. Existing `ReportsService.getAccountsPayable` will still overcount reversed pilot payments if it is used for those invoices. It must be reconciled and updated in a separate, explicitly reviewed legacy-report integration phase before production.
2. Existing payment-list and invoice-detail endpoints do not yet provide reversal-aware totals or flags. Do not treat the new pilot report as a full UI migration.
3. Cross-currency settlements, mixed legacy/pilot payment histories, tax, accounting cut-off dates, chart configuration and historic balance reconciliation are out of scope.
4. Original journal and reversal journal are both retained. Reports that sum ledger lines already include both for their relevant dates; the new operational balance intentionally does not rely on merely summing payment rows.
5. Access restrictions are implemented at controller level; additional HTTP authorization tests should be included before any production rollout.

**Production branch and production database remain untouched.**
