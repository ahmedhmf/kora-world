# Supplier Payments — Phase 2F: Test-only reversible settlement

**Branch:** `feature/accounting-redesign`
**Scope:** isolated supplier EGP pilot, reversal-specific integration tests, and legacy pilot-payment deletion safeguard. **Not deployed or tested in production.**

## What changes

- `POST /payments/supplier-egp-pilot/:id/reverse` accepts `{ "reason": "Actual correction explanation" }`.
- Existing `AuthGuard` requires a session, `RolesGuard` allows accountant/admin; the service re-reads the authenticated actor from `users` and checks the current role.
- Pilot still requires `SUPPLIER_EGP_PILOT=true`, `DATABASE_NAME=kora_test`, loopback host, and a verified connection to `kora_test`. Never enable outside a verified disposable test environment.
- Only payments with the dedicated `payments.request_key` UUID and correctly linked `supplier-payment:<id>:posted:v1` journal can be reversed.
- Each original journal is retained and marked `reversed` with `reversed_by_id` and `reversed_at`. A new posted payment journal with unique `supplier-payment:<id>:reversal:v1` key, `reversal_of_id`, explanation, actor and opposite EGP lines is created atomically.
- The saved Payment row is **retained**. Subsequent pilot payment calculations count only original posted journals without a reversal. A reversed payment is no longer applied to the outstanding invoice amount.
- A reversal uses the same SERIALIZABLE transaction as the original payment code, a locked invoice row, and bounded 40001 retry logic. Duplicate/concurrent reversals reject.
- `PaymentsService.remove` refuses to hard-delete pilot payments whose reference begins `SUP-PAY-`, instead of deleting their journal by reference. Other legacy payment deletions are not changed.
- The original `POST /payments` and invoice booking workflows are unchanged.

## Test cases

`api/src/payments/supplier-egp-pilot.integration.ts` now covers:
1. Reverse a fully paid EGP 1,000 invoice and restore 1,000 outstanding.
2. Original payment retained; original journal retained and marked reversed; reversal journal posts equal/opposite AP and bank lines (net 0).
3. Reverse one partial payment; another active instalment remains counted; a new payment settles the remaining balance correctly.
4. Accountant authorized; employee denied; empty reason rejected.
5. Two concurrent attempts to reverse the same payment cannot produce two reversal journals.
6. Intentional failure after reversal writes rolls back the new journal, original posting status, and invoice status.

Unit checks cover missing reason, invalid actor ID and disabled pilot flag.

## Verify with local `kora_test`

```powershell
cd D:\Ahmed\project\kora-world
git pull --ff-only origin feature/accounting-redesign
cd api
npm run build
npm test -- --runInBand supplier-egp-pilot.service.spec.ts supplier-settlement.policy.spec.ts payments.service.spec.ts
$env:DATABASE_NAME = "kora_test"
$env:DATABASE_HOST = "127.0.0.1"
npm run test:accounting:integration -- supplier-egp-pilot.integration.ts
```

The test writes temporary fixtures in `kora_test` and cleans them after each test. It does **not** start NestJS or run migrations. Do not enable the pilot globally. Production remains unchanged.

## Before real usage

1. The legacy payment deletion safeguard recognizes the pilot's `SUP-PAY-` reference format; it is **not** sufficient protection against database-level edits or later changes to that reference. A future production rollout needs stronger immutable provenance and backend-wide cancellation enforcement.
2. Existing legacy financial endpoints still require authorization and reconciliation review.
3. The reversed payment remains in `payments`, so any legacy reports that sum all payment rows without inspecting journal reversal status may **overstate amounts paid**. Reporting must be updated before rollout.
4. Reversals currently reset an unpaid supplier invoice to `sent`; overdue-date restoration, period-close controls, and external bank reconciliation are not yet implemented.
5. Reversals are limited to the EGP pilot. No FX reversal or legacy journal rewrite.
6. A production migration and activation plan would require explicit authorization.

**Status:** changes committed; build and local PostgreSQL tests are awaiting verification.
