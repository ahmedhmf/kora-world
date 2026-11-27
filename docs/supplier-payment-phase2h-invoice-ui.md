# Phase 2H — Supplier invoice UI: read-only pilot balance and reversal history

Branch: `feature/accounting-redesign`. Status: committed for local build and manual verification; **not deployed**.

## Changes
- `web/src/app/core/services/accounting-api.service.ts`: typed `SupplierPilotInvoiceBalance` and `SupplierPilotPaymentHistory`, `getSupplierPilotInvoiceBalance(id)` using existing Phase 2G backend route.
- `web/src/app/features/accounting/invoices.component.ts`: open/close/refresh state, error/loading feedback and stale response protection.
- `web/src/app/features/accounting/invoices.component.html`: `Pilot balance` button on incoming EGP invoice rows, and read-only modal with invoice total, effective paid, reversed amount, outstanding amount and detailed original/reversal audit entries.

## Safety scope
- The button is presented **only** on localhost/127.0.0.1 for a logged-in accountant or admin, and only for incoming EGP invoices. Client-side gating is UI-only; the backend is authoritative and independently requires the local kora_test flag and authenticated role.
- The panel is **read-only**. It does not call legacy `POST /payments`, invoice update, journal delete, or pilot create/reverse endpoints.
- The main invoice list, existing create/edit modal, and existing global reports are unchanged.
- If pilot reporting is disabled, the invoice is not a compatible pilot invoice, or access fails, it shows an explicit unavailable message; it **never** fills balances from legacy payment rows.
- Currency amounts from API are integer EGP cents; frontend divides by 100 only to display.
- The panel is not an indication that a production migration is approved or that global Accounts Payable reports have been reconciled.

## Verification
```powershell
cd D:\Ahmed\project\kora-world
git pull --ff-only origin feature/accounting-redesign
cd web
npm run build
```

For a manual UI test, ensure the API and web client are running locally against **disposable kora_test**, backend flag `SUPPLIER_EGP_PILOT=true` only in that local process, and log in as accountant/admin. Visit Accounting → Invoices, select an existing **pilot** incoming EGP invoice, click Pilot balance. Confirm original and reversal journal fields and aggregate totals. If no pilot invoice exists (integration tests delete their fixtures), the panel may show a verified zero history or an incompatibility error on legacy invoices; that does not establish an end-to-end browser test.

Do not set the pilot flag or database variables on a production host and do not deploy the branch.

## Next
- Authorize and separately implement pilot supplier payment submission and reversal UI, including unique UUID per user submission, disabled controls during requests and explicit retry guidance.
- Update company-wide supplier AP reporting only after a documented legacy / FX reconciliation plan; the existing report may overcount reversed payment rows.
- Protect legacy write routes and plan production migration and authorization testing before any live rollout.
