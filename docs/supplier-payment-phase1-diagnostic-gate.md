# Supplier Payment Integration — Phase 1 Diagnostic Gate

**Branch:** `feature/accounting-redesign`
**Change scope:** diagnostic tooling, tests, and documentation ONLY. **No changes to invoice/payment/PO posting logic or database content.**

## What was added
- `api/scripts/audit-supplier-postings.js`: direct PostgreSQL client; starts a **REPEATABLE READ, READ ONLY** transaction and rolls it back. Fails closed unless `DATABASE_NAME=kora_test` and `DATABASE_HOST` is local loopback.
- Characterization tests in `api/src/payments/payments.service.spec.ts` and `api/src/invoices/invoices.service.spec.ts`: capture current behavior, including the invoice-status-driven synthetic payment journal and a separate journal created by the payment service.
- These tests describe existing behavior so it can be replaced safely later; they are not assertions that double posting is acceptable.

## Run builds / unit tests (do not connect to DB)

```powershell
cd D:\Ahmed\project\kora-world
git pull --ff-only origin feature/accounting-redesign
cd api
npm run build
npm test -- --runInBand payments.service.spec.ts invoices.service.spec.ts
```

## Run the read-only database audit (only if kora_test is the intended disposable DB)

Do **not** start the NestJS API to run this audit. NestJS AppModule enables `migrationsRun: true`. The script connects directly to Postgres and never invokes migrations.

1. Check your local Postgres connection and verify it cannot point to production. A database named `kora_test` on a local host is necessary but not sufficient proof that its contents are disposable.
2. From a **new** PowerShell terminal, set the test DB name and local host explicitly:
```powershell
cd D:\Ahmed\project\kora-world\api
$env:DATABASE_NAME = "kora_test"
$env:DATABASE_HOST = "127.0.0.1"
node scripts/audit-supplier-postings.js
```
3. The script prints candidate rows for manual review. Do not mistake all multi-payment journals for duplicates; installments, existing reversals and foreign currency differences can be legitimate.
4. Avoid copying customer/supplier names or sensitive amounts into public issue trackers. Share aggregated counts or redact identifiers before sending output to anyone.

## Interpretation
- **Supplier invoices and associated payment counts:** baseline; posted journals and payment counts must be interpreted by payment purpose and posted/reversed status.
- **Potential paid-invoice double-posting:** flags where paid-invoice synthetic journals coexist with payment rows; compare individual journal lines before deciding whether duplicate accounting occurred.
- **Payments without a clearly matching journal:** could be custom references, account history, a failed write, or legitimate differences. Do not automatically re-post.
- **Ambiguous references:** high risk for legacy reference-based deletion, but not necessarily duplicate financial events.
- **Multiple PO-PAY journal records:** investigate manual endpoint use, installment patterns, and actual linked payment records.
- **Supplier invoice journal count:** baseline for determining where booking journals exist before enforcing unique event identity.

## Implementation gate for Phase 2
Do not modify production posting or historical financial data until:
- baseline test DB reconciliation reviewed;
- transaction definitions (invoice liability vs actual cash settlement vs inventory receipt) approved;
- multiple partial payments and FX supported by tests;
- idempotent source event design and migration plan reviewed;
- correction/reversal workflow and API authorization tests in place;
- rollback and balance invariants tested.

**No production deployment or merge is part of this phase.**
