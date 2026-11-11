# Supplier Payments — Phase 2E: DB-enforced unique request keys (test-only)

**Branch:** `feature/accounting-redesign`
**Status:** Implementation committed; developer must run build/tests. **Do not deploy or enable against production.**

## Safe schema rollout design

The explicit script `api/scripts/prepare-supplier-request-key-test-db.js` adds these objects to **local `kora_test` only**:

```sql
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS request_key uuid NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_request_key
  ON public.payments (request_key)
  WHERE request_key IS NOT NULL;
```

**Important:** This script is intentionally **not** in `api/src/migrations`. NestJS starts with `migrationsRun: true`, and we must not accidentally apply this schema change to `kora_world` or other production databases. The test script refuses non-loopback hosts and any database name other than `kora_test`. Existing payment rows keep `NULL` request keys; no historical rows are rewritten.

The shared `Payment` TypeORM entity was deliberately **not changed**, because adding a mapped column before the production rollout would cause unrelated legacy payment reads to fail on production databases missing that column. The isolated test pilot uses guarded, transaction-scoped SQL for the new field.

## Pilot behavior

- User submits a stable UUID `requestKey`; it is stored in `payments.request_key`, enforced by PostgreSQL's unique partial index.
- The readable business reference is now `SUP-PAY-<paymentId>`; it no longer acts as a request identity.
- Replay detection queries the UUID column first and returns the existing payment/journal after verifying invoice, amount, bank and date.
- When the UUID is reused with conflicting details, reject.
- Payment, request key, journal and invoice-status updates remain in one serializable transaction; errors roll back together.
- The original advisory key lock and bounded SQLSTATE 40001 retries remain additional protections.
- Duplicate UUID uniqueness violations are reported as conflicts. They are not automatically retried.
- The legacy `POST /payments` route and FX handling are not modified.

## Local test procedure

```powershell
cd D:\Ahmed\project\kora-world
git pull --ff-only origin feature/accounting-redesign
cd api
npm run build
npm test -- --runInBand supplier-egp-pilot.service.spec.ts supplier-settlement.policy.spec.ts

# Only after confirming this is your DISPOSABLE local test database:
$env:DATABASE_NAME = "kora_test"
$env:DATABASE_HOST = "127.0.0.1"
node scripts/prepare-supplier-request-key-test-db.js

npm run test:accounting:integration -- supplier-egp-pilot.integration.ts
```

The explicit schema preparation persists on `kora_test`; the integration test creates and cleans up disposable invoice and payment rows.

## Acceptance checks

- `payments.request_key` exists as nullable UUID in `kora_test`, with a unique index.
- A pilot settlement stores request UUID and readable reference separately.
- A second HTTP-style request with the same UUID and identical parameters replays rather than inserting.
- Duplicate UUIDs are directly rejected by PostgreSQL with unique constraint error `23505`.
- Two concurrent requests cannot double-post or exceed invoice total.
- Legacy payments still work without a request UUID.

## Remaining production blockers

1. A separate reviewed production migration and deployment sequencing plan, after explicit permission.
2. A dedicated formal immutability enforcement strategy for request identity and prohibition of manual edits; the current unique index alone does not make the field immutable.
3. End-to-end authorization tests for old and new financial routes.
4. Reversal-based correction and reconciliation workflows, avoiding destructive journal deletion.
5. Confirm invoice/payment reporting and Chart of Accounts mappings.

**No production DB changes are authorized or performed by this phase.**
