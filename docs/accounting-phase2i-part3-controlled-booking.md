# Phase 2I Part 3 — Controlled EGP supplier draft booking (first cutover)

**Branch:** `feature/accounting-redesign`. **Status: committed, not build- or database-tested by assistant.** No production or historical data modified.

## Narrow implementation

New service: `api/src/invoices/controlled-supplier-invoice-booking.service.ts`

New admin-only endpoint: `POST /invoices/controlled-egp-pilot/:id/book`

It books an **existing DRAFT, incoming EGP supplier invoice** into one posted invoice journal (debit 5100 supplier expense, debit 2200 VAT if positive, credit 2100 Accounts Payable), and changes the invoice status to SENT. It does **not** mark invoices PAID or create any payment journal. Real supplier settlements continue through the existing controlled supplier payment endpoint.

The invoice row is pessimistically locked inside a SERIALIZABLE transaction. Existing invoice journals or payment rows cause refusal (no silent re-posting); a repeat request succeeds only for the single matching posted booking event. Integer EGP cents are checked for total = subtotal + tax. Posting accounts must be active, leaf, EGP, and expected type. The journal and invoice status are written inside one transaction; either both commit or both roll back. PostgreSQL serialization conflicts receive bounded retries.

The endpoint is independently gated by admin role, `SUPPLIER_EGP_PILOT=true`, `CONTROLLED_INVOICE_BOOKING=true`, `DATABASE_NAME=kora_test`, loopback host, and `current_database() = kora_test` within the write transaction. The operation never runs against a production database by design.

When the new controlled booking flag is enabled **together with the supplier pilot in local kora_test**, legacy invoice create/update operations cannot issue incoming EGP invoices as SENT via the legacy posting path. Legacy PAID posting remains forbidden under the existing supplier-pilot gate. The controlled booking flag does not disrupt the pre-existing supplier pilot unless explicitly enabled.

**Manual currency policy retained:** EUR/USD legacy operations and any operator-entered exchange rates remain unchanged. No automatic FX functionality is added.

## Usage and test verification

```powershell
cd D:\Ahmed\project\kora-world
git pull --ff-only origin feature/accounting-redesign

cd api
npm run build
npm test -- --runInBand controlled-supplier-invoice-booking.service.spec.ts invoices.service.spec.ts legacy-supplier-pilot.policy.spec.ts supplier-egp-pilot.service.spec.ts

# Existing real DB supplier settlement regression, disposable kora_test only
$env:DATABASE_NAME = 'kora_test'
$env:DATABASE_HOST = '127.0.0.1'
npm run test:accounting:integration -- supplier-egp-pilot.integration.ts
```

For a **manual endpoint smoke test** only after verifying that the local Nest API points at disposable `kora_test`, run your local backend with these additional flags (never set on production):

```powershell
$env:DATABASE_NAME = 'kora_test'
$env:DATABASE_HOST = '127.0.0.1'
$env:SUPPLIER_EGP_PILOT = 'true'
$env:CONTROLLED_INVOICE_BOOKING = 'true'
npm run start:dev
```

1. Log in as an admin locally and create a **DRAFT** incoming EGP invoice using the existing invoice API/UI.
2. Make sure `5100`, `2100`, and `2200` (if tax is positive) are active **leaf EGP** accounts of expected types. If these do not meet validation, the posting will refuse; do not alter financial accounts automatically.
3. POST `http://localhost:3000/invoices/controlled-egp-pilot/<invoiceId>/book` with authenticated session. Response: `{invoiceId,journalId,status:'sent',replayed:false}`.
4. Repeat the exact request: expect `replayed:true`, identical journal ID, zero new journals.
5. Verify exactly one booking journal, matching balanced lines, and a SENT invoice. Then create a real supplier pilot payment and confirm one linked payment journal per payment.
6. Confirm accountant/employee roles cannot book. Verify that legacy draft-to-SENT requests are rejected only when controlled booking is explicitly enabled.
7. Verify that invoices with existing booking/payment histories are rejected instead of rewritten.

## Remaining work / guardrails

- No actual audit findings were supplied in the conversation, so this implementation **does not attempt to migrate or repair any historical transactions**.
- Automatic browser-side invoice booking UI is not yet implemented; use the authenticated test endpoint for this narrow step.
- Unit tests were added; running the new service against the local PostgreSQL database and concurrent-call tests are still required before declaring it fully verified.
- The existing legacy invoice/payment flows and global financial reporting have not been migrated. This is not a production rollout.
- No automatic currency conversion or scheduled FX processing (former Phase 2K).


## PostgreSQL integration tests added

`api/src/invoices/controlled-supplier-invoice-booking.integration.ts` adds 8 real PostgreSQL checks: balanced invoice booking with no synthetic payment journal, verified replay, concurrent same-invoice requests, refusal of existing history, mismatched total rejection, foreign-currency preservation, feature flag safety, and transaction rollback after simulated invoice-status persistence failure.

The tests use only a disposable `kora_test` connection and verify `SELECT current_database()` before creating any fixture. They never enable automatic migrations or schema synchronization. Each test creates one unique invoice ID, and cleanup is scoped to that exact fixture. Existing accounts `5100` (active leaf EGP expense) and `2100` (active leaf EGP liability) are required; tests abort rather than modify the chart of accounts when these prerequisites are missing.

Run from PowerShell:

```powershell
cd D:\Ahmed\project\kora-world
git pull --ff-only origin feature/accounting-redesign
cd api

npm run build
npm test -- --runInBand controlled-supplier-invoice-booking.service.spec.ts invoices.service.spec.ts

# Set only after verifying this is disposable local kora_test.
$env:DATABASE_NAME = 'kora_test'
$env:DATABASE_HOST = '127.0.0.1'
npm run test:accounting:integration -- controlled-supplier-invoice-booking.integration.ts
```

The test file sets `SUPPLIER_EGP_PILOT` and `CONTROLLED_INVOICE_BOOKING` in its own test process and restores their prior values afterward. Do not enable these flags in production.

**Status:** Integration test code committed, but not executed in the developer's local PostgreSQL runtime by this assistant. A passing unit suite or the existing 15 supplier-payment integration tests does not by itself verify these 8 new booking tests.
