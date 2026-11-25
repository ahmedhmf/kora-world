# Phase 2I Part 3 — Controlled booking Angular interface

**Branch:** `feature/accounting-redesign`. **Status:** committed; local Angular build and browser verification required. No production changes.

## What changed

- `web/src/app/core/services/accounting-api.service.ts`: typed `bookControlledSupplierInvoice(invoiceId)`, `POST /invoices/controlled-egp-pilot/:id/book`.
- `web/src/app/features/accounting/invoices.component.ts`: local admin-only booking confirmation, one in-flight request at a time, error/uncertain-outcome state with same-invoice replay, success message, and invoice/journal refresh.
- `web/src/app/features/accounting/invoices.component.html`: **Book Invoice** action for draft incoming EGP invoices, confirmation dialog explaining that invoice booking is not a payment, and an explicit uncertain-response retry flow.
- Incoming/outgoing type and supplier selection are exposed in the create/edit invoice form. Editing an incoming invoice now preserves its type and supplier rather than accidentally switching to outgoing.

## Scope and safeguards

- The button appears only on a localhost/127.0.0.1 frontend for an **admin** and a **DRAFT incoming EGP invoice**.
- The frontend does **not** assert the backend flags are enabled. A disabled pilot returns a server-side rejection; the UI remains a presentation guard only.
- The backend enforces `SUPPLIER_EGP_PILOT=true`, `CONTROLLED_INVOICE_BOOKING=true`, `DATABASE_NAME=kora_test`, loopback host, admin auth, and actual `current_database()=kora_test`.
- The backend serializes and validates booking in a single transaction, accepting replays of the exact original posting. A failed/uncertain frontend response does not create a fresh booking identity; it retries the same invoice.
- Payment recording still requires the separate supplier pilot payment endpoint and its request UUID.
- No automatic FX conversion feature is added. Existing manual EUR/USD workflows remain available and unchanged.

## Local verification

```powershell
cd D:\Ahmed\project\kora-world
git pull --ff-only origin feature/accounting-redesign
cd web
npm run build
```

Only after verifying that the local API points to a **disposable** PostgreSQL `kora_test` database, run backend from its own local terminal:

```powershell
cd D:\Ahmed\project\kora-world\api
$env:DATABASE_NAME = 'kora_test'
$env:DATABASE_HOST = '127.0.0.1'
$env:SUPPLIER_EGP_PILOT = 'true'
$env:CONTROLLED_INVOICE_BOOKING = 'true'
npm run start:dev
```

From the local frontend as admin:
1. Accounting → Invoices → Record Invoice → **Incoming · Supplier**. Select supplier, choose EGP, set Draft, enter a positive amount, and save.
2. On the draft row, click **Book Invoice**. Confirm. Expect one journal and SENT status.
3. Refresh invoices and journals. Booking button should disappear for SENT invoices; **Pilot balance** should show the booked invoice.
4. Repeat the request via the API or simulate a lost browser response; a same-invoice retry must confirm the same journal, not create a second one.
5. Use the separate payment form for a real partial/full settlement. Verify only one payment journal per payment.
6. Check role restrictions (accountant cannot book), unsupported invoice currencies, and server rejection with booking flag disabled.
7. Check that an incoming invoice edited in the UI retains incoming type and supplier.

## Known limitations

- The UI cannot determine the server's feature flag before the first request; a visible Book Invoice button does not prove booking is enabled.
- The booking retry state is in memory. On reload after an uncertain response, verify invoice and journals before taking new actions.
- No automated Angular component test suite or browser end-to-end run was executed by this assistant.
- Global accounting report reconciliation and production migration are separate future work.
