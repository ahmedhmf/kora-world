# Supplier Payments — Phase 2D: Bounded Serialization Retries

**Branch:** `feature/accounting-redesign`  
**Activation:** Still disabled outside the explicit local-only `kora_test` pilot. No migrations, production changes, or changes to legacy `POST /payments`.

## Implementation

`SupplierEgpPilotService.create` now wraps the complete `SERIALIZABLE` database transaction in a bounded retry helper.

- Attempts at most **3 full transactions** when PostgreSQL reports SQLSTATE `40001` (either on the outer error or TypeORM's `driverError.code`).
- Uses short bounded delays between retries. Each attempt runs a new transaction; TypeORM rolls back the failed attempt before returning an error.
- Reuses the **same user-supplied UUID request key**. This is crucial: changing the UUID on retry would risk a second payment.
- Errors other than `40001` are passed through without retry (e.g. overpayment, wrong invoice, uniqueness, authorization, missing account, or ordinary connection failure).
- After 3 consecutive conflicts, propagates the original error to the caller; the caller should retry the **same** request key later, not create another.
- Existing transaction-level invoice locking, advisory UUID key locking, ledger source event key, and entire payment/journal/invoice-status atomicity are retained.

## Tests

Unit cases added in `api/src/payments/supplier-egp-pilot.service.spec.ts`:
1. First transaction fails with `40001`, second succeeds using the same request key.
2. Three failures return the serialization error with no saved payments.
3. Validation failures, ordinary errors and uniqueness errors do **not** cause retries.

The existing PostgreSQL integration cases also cover simultaneous duplicate requests and overpayment races.

## Verify locally

```powershell
cd D:\Ahmed\project\kora-world
git pull --ff-only origin feature/accounting-redesign
cd api
npm run build
npm test -- --runInBand supplier-egp-pilot.service.spec.ts supplier-settlement.policy.spec.ts
$env:DATABASE_NAME = "kora_test"
$env:DATABASE_HOST = "127.0.0.1"
npm run test:accounting:integration -- supplier-egp-pilot.integration.ts
```

The integration test writes **temporary** fixtures and removes them afterwards. Confirm your local `kora_test` is disposable before running. The pilot flag is set within the Jest process only.

## Important remaining prerequisites

- Before production readiness, use a **dedicated immutable request-key column with a DB uniqueness constraint**; the current pilot uses the mutable `payments.reference` string and an advisory lock, which are not equivalent to a durable unique key.
- Add explicit reconciliation and reversal/cancellation support; legacy financial endpoints must not be allowed to bypass the final accounting rules.
- Validate real chart-of-accounts mappings, authorization boundaries and partial-payment handling across UI and reports.
- No new production API behavior is enabled. Do not globally set `SUPPLIER_EGP_PILOT=true`.
