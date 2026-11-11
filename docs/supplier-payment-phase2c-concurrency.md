# Supplier Payments — Phase 2C: Concurrency verification

**Branch:** `feature/accounting-redesign`
**Scope:** two new PostgreSQL integration tests only. Existing payment, posting, schema, routes, and production data are unchanged.

The new cases in `api/src/payments/supplier-egp-pilot.integration.ts` intentionally send simultaneous requests:

1. **Same UUID and same payment details:** exactly one payment and payment journal must persist. Under PostgreSQL SERIALIZABLE isolation, a concurrent request may fail with SQLSTATE 40001; a subsequent retry with the same UUID must return the original payment and journal, without writing again.
2. **Different UUIDs, conflicting amounts:** two EGP 600 payments against an EGP 1,000 invoice must result in exactly one committed payment and journal. The other must fail, and retrying it must still be refused rather than overdrawing the invoice.

## Commands (disposable local kora_test only)

```powershell
cd D:\Ahmed\project\kora-world
git pull --ff-only origin feature/accounting-redesign
cd api
npm run build
$env:DATABASE_NAME = "kora_test"
$env:DATABASE_HOST = "127.0.0.1"
npm run test:accounting:integration -- supplier-egp-pilot.integration.ts
```

**Note:** Tests write and remove disposable financial fixtures; never run against a database containing real company financials. Test file does not import NestJS AppModule and does not run migrations. Do not enable pilot flag globally.

## Before production activation

- Add safe handling of SQLSTATE `40001` serialization conflicts, including bounded retry for the *same* request key. Current pilot may return an error under a race; it is designed to avoid duplicate writes, not provide transparent retries.
- Move HTTP-request idempotency to a dedicated uniquely constrained, immutable key rather than relying on a payment reference and advisory lock alone.
- Verify role restrictions and disable or replace legacy financial write routes that bypass the new accounting workflow.
- Implement reversal-based corrections instead of direct deletion of posted payment journals.
- Confirm partial-payment status is understood by every relevant UI and reporting path.
- Review real chart-account classification and foreign-currency requirements separately.
- Do not deploy any phase to production without explicit approval.

**Status:** awaiting local integration test results. No production changes.
