# Accounting transition: Phase 2H UI correction + Phase 2I local safeguard

**Branch:** `feature/accounting-redesign`.
**Status:** Changes committed, awaiting local build/unit/integration/browser verification.
**No production migration, deployment, or data changes.**

## Phase 2H completed bug fix

Fixed over-escaped regular expressions in `web/src/app/features/accounting/invoices.component.ts`:
- Exact decimal EGP amounts now parse using the intended `\\d` and `\\.` tokens.
- ISO dates now use intended `\\d` digit classes.
- Existing browser UUID replay mechanism and backend-only `kora_test` gate are unchanged.

## Phase 2I: incremental local-only coexistence guard

New `api/src/payments/legacy-supplier-pilot.policy.ts` supports a narrow safety gate when **all** are true:
- `SUPPLIER_EGP_PILOT=true`
- `DATABASE_NAME=kora_test`
- `DATABASE_HOST` is loopback (or unset, matching the supplier pilot's loopback default)
- Invoice is **incoming EGP**

Only while that isolated pilot mode is explicitly active:

- `PaymentsService.create` rejects legacy supplier payments *before payment persistence*. Use controlled `POST /payments/supplier-egp-pilot` instead.
- `PaymentsService.remove` rejects destructive deletion of EGP supplier payments even with old references.
- `InvoicesService.create` rejects incoming EGP invoices created directly as `PAID`, avoiding synthetic payment journals. Record a `SENT` invoice booking then settle through the controlled pilot service.
- `InvoicesService.update` rejects direct `PAID` status transitions on incoming EGP invoices. It also rejects financial-field edits to **already-booked** EGP supplier invoices in local pilot mode; such adjustments require a future controlled credit/rebooking workflow.
- `InvoicesService.remove` rejects legacy deletion of these incoming EGP invoices.

**Outside pilot mode:** Existing legacy logic intentionally remains unchanged, including known risks. Do not interpret the guard as the complete legacy migration or production-ready enforcement.

**Important limitations:** This policy gate uses runtime environment settings; it does not independently query actual database identity. Actual pilot write endpoints also check `current_database()` inside their transactions. The policy is an interim coexistence safeguard, not the final production authorization or posting engine. Historical legacy journals are not changed or reconciled. No migration or automatic backfill is performed. Global AP reports still need reversal-aware reconciliation. Legacy EUR/USD workflows are unchanged.

## Tests added

- `api/src/payments/legacy-supplier-pilot.policy.spec.ts`: gating, scope, loopback fallback, production-off cases.
- `api/src/payments/payments.service.spec.ts`: reject legacy incoming EGP creation/deletion before writing.
- `api/src/invoices/invoices.service.spec.ts`: reject synthetic paid-status posting, booked-invoice edits and deletion.

## Run locally

```powershell
cd D:\Ahmed\project\kora-world
git pull --ff-only origin feature/accounting-redesign

cd web
npm run build

cd ..\api
npm run build
npm test -- --runInBand legacy-supplier-pilot.policy.spec.ts payments.service.spec.ts invoices.service.spec.ts supplier-egp-pilot.service.spec.ts supplier-settlement.policy.spec.ts

# Only disposable LOCAL kora_test. These tests create and remove fixtures.
$env:DATABASE_NAME = 'kora_test'
$env:DATABASE_HOST = '127.0.0.1'
npm run test:accounting:integration -- supplier-egp-pilot.integration.ts
```

For a manual browser smoke test on local test-only API, check:
1. EGP amount `40.50` and valid ISO payment date pass the form.
2. Admin can create one pilot payment; immediate double submit is blocked; balances refresh.
3. Accountant can reverse but not create.
4. Direct legacy `POST /payments`, invoice `PAID` status changes, destructive deletes reject **only while the local pilot is enabled**.
5. With pilot disabled, ensure longstanding legacy regression tests continue to pass unchanged.

## Remaining Phase 2I work (not completed here)

Full conversion of legacy journal posting to one transactional, idempotent, production-approved engine; migration of EUR/USD customer/supplier transactions; preserving immutable historic journals; correcting global reporting; database-enforced production request keys; close-period/credit-note adjustments; and reconciliation of historical company data. This must be separately designed and tested before production rollout.
