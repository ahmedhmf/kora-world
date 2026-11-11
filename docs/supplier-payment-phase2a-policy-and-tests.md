# Supplier Payment Integration — Phase 2A (Isolated Policy & Tests)

**Date:** 2026-11-11
**Branch:** `feature/accounting-redesign`
**Status:** Code committed; local build/tests must be run by developer. **No live payment posting changes.**

## New code

- `api/src/payments/supplier-settlement.policy.ts` — pure, isolated EGP settlement calculator and prospective journal-event mapper
- `api/src/payments/supplier-settlement.policy.spec.ts` — unit fixture cases for partial/full payments, overpayments, data validation, journal mapping, stable event IDs, and account selection

These files are **NOT imported into the NestJS module, existing PaymentsService, InvoicesService, or controllers**. They cannot change accounting balances by themselves. No migration, database write, production deployment, or new API route was added.

## Agreed prospective business contract (EGP supplier invoice only)

1. Issuing an incoming supplier invoice books the supplier obligation once, according to approved inventory/expense/tax treatment. It does **not** imply a cash payment.
2. A real saved supplier payment is the sole source of the settlement posting. Each payment receives the deterministic unique key `supplier-payment:<paymentId>:posted:v1`, regardless of user-supplied reference text.
3. Settlement posting is **Debit Accounts Payable 2100** / **Credit selected cash or bank 11xx** for the payment amount. It does not debit expense or COGS again.
4. Partial payments accumulate in **integer EGP cents**. Invoice status transitions sent/overdue → partially_paid → paid, with no overpayments.
5. Invoice status changes do not synthesize a separate cash journal. This is a *future integration change*, not yet applied.
6. Posted corrections should be made via linked journal reversals, not deleting an arbitrary journal by reference.
7. Customer receipts, invoice-free expenses, PO receipts, cross-currency transactions, inventory capitalization, tax changes, and historic reconciliation are outside this EGP supplier settlement pilot.

## Tests / fixture values

The test invoice is EGP 1,000 and has no prior payments:
- First instalment EGP 400 → 600 remaining, partially paid
- Second EGP 250 → 350 remaining, partially paid
- Final EGP 350 → 0 remaining, paid
- EGP 1,000.01 initial payment is refused; 0/negative/fractional cents refused
- USD invoices and EUR payments refused
- Payment-ID 75 maps to source event key `supplier-payment:75:posted:v1`, stable across different reference strings
- Source and destination account IDs must match verified account selections. AP must be active leaf liability EGP account with code 2100; bank must be active leaf EGP asset with code starting 11

**IMPORTANT DESIGN DEPENDENCY:** If account `2100` is a parent account in your actual chart, this exact mapping must be replaced by a configured posting-level AP account before activation. The strict code policy deliberately fails rather than silently posting to a parent.

## Verification commands

```powershell
cd D:\Ahmed\project\kora-world
git switch feature/accounting-redesign
git pull --ff-only origin feature/accounting-redesign

cd api
npm run build
npm test -- --runInBand supplier-settlement.policy.spec.ts
npm test -- --runInBand payments.service.spec.ts invoices.service.spec.ts
```

The new tests are unit-only. No DATABASE_NAME or Postgres setup is needed to run them.

## Remaining work before connecting to real PaymentsService

1. Verify the actual chart: 2100/AP and 11xx/bank availability and leaf status.
2. Review real meanings of supplier invoice, purchase-order receipt, goods receipt, tax and payment; decide whether invoice debits Inventory (asset) or Expense and when.
3. Implement EGP-only path behind an explicit feature flag, with DB transaction wrapping the payment insert, AP/bank journal insert, and invoice status update.
4. Avoid calling `InvoicesService.update` in a way that generates a synthetic `invoice.number-PAY` journal; separate invoice-status updates from journal generation.
5. Preserve unchanged legacy workflows for all other cases, including EUR/USD. Do not silently apply the EGP-only policy to existing foreign-currency payments.
6. Add integration tests (using an isolated `kora_test` transaction that rolls back) to prove payment and journal atomicity, duplicate-request behavior, concurrent partial-payment safety, and reversals.
7. Add a client-generated idempotency request key for retries; the deterministic `paymentId` event key alone does **not** stop duplicate Payment rows if an entire HTTP request is retried.
8. Audit existing supplier financial records before enabling for any real company database.
9. Replace legacy destructive journal deletion with reversal in a separately reviewed migration/compatibility step.

**Safety:** This document describes a future integration contract. Nothing in Phase 2A has been activated or deployed.
