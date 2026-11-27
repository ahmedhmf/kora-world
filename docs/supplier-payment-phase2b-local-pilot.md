# Phase 2B — Local-only supplier payment pilot

**Branch:** `feature/accounting-redesign`
**Status:** Implemented on branch, not activated, build/tests not yet independently verified. **No production or database modifications performed by this change.**

## Design

A deliberately separate, disabled-by-default endpoint:
`POST /payments/supplier-egp-pilot`

- **Admin-only** via `AuthGuard` + `RolesGuard` + `@Roles('admin')`.
- **Off unless** `SUPPLIER_EGP_PILOT=true`, explicit `DATABASE_NAME=kora_test`, and a loopback host. Actual connected database name is also checked within the transaction.
- Original `POST /payments` and invoice/PO flows are **not modified**.
- EGP incoming (supplier) invoices only, already issued and containing **exactly one posted invoice booking**.
- Strictly refuses invoices with legacy/ambiguous payment journals. No historical cleanup.
- Requires leaf EGP payable account code **2100**, and a selected active EGP 11xx bank/cash account. If `2100` is a parent, the pilot deliberately rejects it pending chart mapping decisions.
- Writes payment, AP debit / bank credit journal, and supplier invoice status within a single **SERIALIZABLE** database transaction; does not call `InvoicesService.update`, avoiding its synthetic payment journal trigger.
- Locks the invoice row, also uses transaction advisory lock on a UUID request key, and uses unique `source_event_key=supplier-payment:<paymentId>:posted:v1`.
- Request key is stored in the payment reference as `SEGP-<uuid>`. The same request key and identical details return the original result without posting again. Reusing a key with different amount, date, bank or invoice rejects.
- Supports partial and full EGP settlement, refuses overpayments and unknown currency conversions.
- Exposes no UI yet. `SUPPLIER_EGP_PILOT` must remain **unset** until the isolated test DB prerequisites and tests are verified.

## Request body (test-only, do not use against real company data)

```json
{
  "invoiceId": 7,
  "bankAccountId": 11,
  "amountCents": 40000,
  "date": "2026-11-11",
  "requestKey": "d13a9655-c750-48ec-ac2e-ed6c1868d532",
  "description": "Test supplier installment"
}
```

A new UUID is required for each new intentional payment, but **retries must reuse the same UUID**. Amount uses integer **EGP cents** (40000 = 400.00 EGP). The invoice ID and bank-account ID are test placeholders.

## Build and unit tests

```powershell
cd D:\Ahmed\project\kora-world
git switch feature/accounting-redesign
git pull --ff-only origin feature/accounting-redesign
cd api
npm run build
npm test -- --runInBand supplier-settlement.policy.spec.ts supplier-egp-pilot.service.spec.ts
npm test -- --runInBand payments.service.spec.ts invoices.service.spec.ts
```

**Do not enable the pilot just to run these tests.** They use mocks and do not require PostgreSQL.

## Known remaining activation gates

1. Confirm local disposable `kora_test` has migrations, an EGP leaf AP account 2100 and EGP leaf bank accounts 11xx. If not, update account configuration intentionally after separate review.
2. Add real PostgreSQL integration tests that create a disposable supplier invoice and journal, exercise pilot payments, retries, concurrent partial payments, and forced failure rollback; clean up test data.
3. Validate existing invoice booking and FX semantics: current legacy booking uses 5100/2200/2100 and must reflect company accounting policy.
4. For high-volume retry races across different invoices, advisory hash collisions only serialize more requests, not corrupt data, but serialization failures can cause client retry. Test 40001 handling before deployment.
5. Request-key persistence currently uses the payment `reference` column rather than a dedicated immutable constraint. Invoice locks + advisory lock serialize this endpoint; for eventual production use consider a dedicated unique request-key column/migration, schema approval, and data compatibility tests.
6. Check the role/authorization behavior of all older financial routes, since they remain callable independently.
7. Review whether invoice status `partially_paid` is supported everywhere in existing reports and UI.
8. Implement audit-preserving reversal/cancellation; never delete posted settlement journals by reference.
9. Preserve EUR/USD and other currencies on legacy routes; no FX policy added.

**CRITICAL:** `api/src/app.module.ts` still uses `migrationsRun:true`. Do not start the API against any database without independently verifying which migrations are pending. No new migration was introduced in Phase 2B.
