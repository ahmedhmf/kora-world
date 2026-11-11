# Supplier EGP Pilot — PostgreSQL Integration Verification

**Branch:** `feature/accounting-redesign`. No production deployment, migration, or live posting changes. The pilot endpoint remains disabled unless explicitly enabled for local `kora_test`.

## Added in this stage

- `api/scripts/check-supplier-pilot-readiness.js`: **read-only** local-`kora_test` check for an active leaf EGP liability account code `2100` and at least one active leaf 11xx EGP bank/cash account. Never starts NestJS or runs migrations.
- `api/src/payments/supplier-egp-pilot.integration.ts`: real PostgreSQL integration test using disposable invoices, journals, bank/expense accounts and payments, followed by fixture cleanup.

### Phase 2B integration assertions

1. A supplier invoice for EGP 1,000 is issued and has exactly one booked AP journal.
2. First payment EGP 400 → invoice partially_paid, 600 remaining; second payment EGP 600 → fully paid, 0 remaining; exactly two saved payment rows and two matching AP/bank payment journals.
3. Repeating the same UUID and details returns the same payment/journal rather than writing twice.
4. Reusing a UUID for a different payment amount is rejected.
5. Forcing a failure after performing all writes in the transaction rolls back the payment, journal, and invoice status.

**Scope limitation:** these tests do not yet cover simultaneous requests or process crashes. A DB-level unique request-key constraint and transactional retry policy are still needed before production activation.

## Step 1 — Unit/build checks (no database needed)

```powershell
cd D:\Ahmed\project\kora-world
git pull --ff-only origin feature/accounting-redesign
cd api
npm run build
npm test -- --runInBand supplier-egp-pilot.service.spec.ts supplier-settlement.policy.spec.ts
```

## Step 2 — Read-only readiness check

Only use a **verified disposable** local `kora_test`. Never use a production DB or a local proxy to production.

```powershell
cd D:\Ahmed\project\kora-world\api
$env:DATABASE_NAME = "kora_test"
$env:DATABASE_HOST = "127.0.0.1"
node scripts/check-supplier-pilot-readiness.js
```

The check prints READY or NOT READY. **If NOT READY, do not change account 2100 or production charts automatically.** Share the readiness output so the correct test-only account mapping can be chosen.

## Step 3 — Real PostgreSQL integration test (writes temporary fixtures to kora_test)

Run only after readiness says READY, after confirming `kora_test` contains no real business financials, and after ensuring your test migrations were already applied. This test **writes temporary rows and cleans up at the end**.

```powershell
cd D:\Ahmed\project\kora-world\api
$env:DATABASE_NAME = "kora_test"
$env:DATABASE_HOST = "127.0.0.1"
npm run test:accounting:integration -- supplier-egp-pilot.integration.ts
```

The test sets `SUPPLIER_EGP_PILOT=true` within the Jest process and restores its previous value. **Do not set this flag globally or run `npm run start:dev` for this test**; API startup has `migrationsRun: true`. No new migration is introduced here.

If the test fails partway, it attempts targeted cleanup in `afterEach`. Because an interrupted process can still leave fixtures, review for `IT-SUP-*`, `11IT*`, `5IT*`, and `test:invoice:*` in `kora_test` before rerunning. Never clean by broad patterns without verifying the data.

## What happens after a pass

Phase 2C will review concurrency handling and the need for a dedicated idempotency field/unique index, followed by authorization tests and a controlled pilot UI. Legacy `POST /payments` and supplier invoice posting have **not** been replaced.

**Important:** A READY readiness check only validates account prerequisites, not historical accounting correctness or general production readiness.
