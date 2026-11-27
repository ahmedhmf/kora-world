# Phase 2J-D — Accounting Reconciliation Dashboard

**Status:** Implemented on `feature/accounting-redesign`. Angular build and manual browser verification required. No production deployment or data corrections.

## Location

**Accounting → Reconciliation Dashboard** (local Angular app, admin only)
Route: `/accounting/reconciliation`.

The dashboard reuses two **existing read-only** backend endpoints:

1. `GET /accounting/reconciliation-audit` — all-invoice structural audit (admin-only); requires `ACCOUNTING_RECONCILIATION_AUDIT=true`.
2. `GET /accounting/phase2j-report?startDate=...&endDate=...&asOfDate=...` — Phase 2J financial statement and subledger preview; requires `ACCOUNTING_PHASE2J_REPORT=true`, admin or accountant role.

**Both endpoints independently verify** configured local host, `DATABASE_NAME=kora_test`, and PostgreSQL `current_database()=kora_test` inside read-only `REPEATABLE READ` transactions. They do not write to the database. Because the two endpoints create **separate transactions**, the dashboard does **not** claim one atomically consistent cross-endpoint snapshot.

## Features

- Counts audited invoices, flagged invoices, total issue findings, and AP/AR rows excluded from verified totals.
- Shows verified AP and AR outstanding EGP amounts. Invoices with ambiguous history are excluded from verified totals, not silently counted.
- Consolidates audit invoice issues and Phase 2J issues into a searchable, filterable queue; supports grouping by Invoices, Payments, Journals, Currency / Other.
- Shows unassigned Payment and payment-type Journal IDs. These may be legitimate standalone transactions and **require review**, not automatic deletion.
- Links to the existing invoice, journal, payment, and financial reports sections. Links open the section; automatic selection of the exact row is not implemented.
- Displays the balance-sheet difference and warns about unclosed income, bank reconciliation, and manual FX verification.

This dashboard performs **no** ledger writes, reversal operations, automatic repairs, rate conversion or historical backfills. The older accounting reports remain unchanged. No new database migrations are required.

## Local setup / verification

```powershell
cd D:\Ahmed\project\kora-world
git pull --ff-only origin feature/accounting-redesign

cd web
npm run build

cd ..\api
npm run build
npm test -- --runInBand invoice-payment-reconciliation.spec.ts invoice-payment-reconciliation.service.spec.ts phase2j-report.policy.spec.ts phase2j-report.service.spec.ts
```

After **verifying** that your backend really connects to a disposable local PostgreSQL `kora_test`, restart the local backend from the **same PowerShell window**:

```powershell
cd D:\Ahmed\project\kora-world\api
$env:DATABASE_NAME = 'kora_test'
$env:DATABASE_HOST = '127.0.0.1'
$env:ACCOUNTING_RECONCILIATION_AUDIT = 'true'
$env:ACCOUNTING_PHASE2J_REPORT = 'true'
npm run start:dev
```

Then open the localhost Angular app while signed in as an **admin**, open Accounting → Reconciliation Dashboard, and press **Refresh reconciliation**.

Acceptance checks:
- Both endpoints return HTTP 200 and the dashboard displays counts and filtered findings.
- Search and category changes refresh results without another API call.
- Refresh updates results after changes made elsewhere in `kora_test`.
- Broken journal links show up as investigation warnings; none are modified.
- Accountant or employee accounts cannot call the admin-only structural audit; the dashboard is not visible to them.
- Non-local frontend hides the dashboard content, and the backend rejects non-`kora_test` API calls.

If you see a 403, check the response text in browser Network tools: both flags must be set in the same terminal starting the backend; the user must be an admin for the structural audit. **Never bypass** these safety checks.

## Remaining work

- Local Angular compilation/browser testing and screenshot review have not been performed by this assistant.
- This screen is a **review queue**, not an issue-resolution system. A persistent accountant acknowledgement workflow and audited corrections require separate design and testing.
- The dashboard does not compare ledger amounts with actual bank statements, and does not assert the validity of any manually entered foreign exchange rate.
- To reconcile historical legacy records for eventual production, review flagged records one at a time before proposing migrations or backfills.
