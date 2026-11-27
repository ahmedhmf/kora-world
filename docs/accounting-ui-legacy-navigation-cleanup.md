# Accounting UI legacy navigation cleanup — 27 November 2026

Branch: `feature/accounting-redesign`. No changes to `main`, backend APIs, financial records or production deployments.

## Implemented now

1. **Removed the old generic `Payments` link from the primary Accounting sidebar** in `web/src/app/layout/layout.component.ts`. It is not the controlled supplier-payment flow and overlaps with **Simple Accounting → Money Out**. The old link was misleading to operational staff.
2. **Clarified the old screen** `web/src/app/features/accounting/payments.component.html` with the heading **Legacy Payments** and warnings to verify existing invoices and avoid duplicate posting before making new entries.
3. **Separated old and controlled report labels** in `web/src/app/features/accounting/reports.component.ts`. The former Profit & Loss, Balance Sheet and Cash Flow tabs are now explicitly **Legacy**. The isolated Phase 2J tab is labelled **Verified EGP Preview (Local)**; this remains a read-only local diagnostic, not accountant-certified.
4. Added a note to `reports.component.html` that legacy reports have not been independently reconciled and should not be used as approved accounting statements.

## Why the old files/routes were not deleted

- The historical `/accounting/payments` route and old component are still available by direct URL. The screen contains a manual currency/rate flow for EUR and USD, for which the new EGP-only Simple Accounting screen is **not** a drop-in replacement.
- Older reports may be needed to compare historical/manual-currency records before accountant approval.
- Removing a sidebar link is presentation-only; it does not enforce authorization at the API layer. The legacy Payments API still needs a separately approved behavior/security review.
- `/accounting/invoices` and `/accounting/journal` remain because their screens also expose current controlled-pilot workflows.
- `/accounting/chart-of-accounts`, `/accounting/reconciliation`, `/accounting/bank-reconciliation` and `/accounting/production-readiness` are intentionally retained.
- No invoice/payment/journal entity, migration, or database record was dropped.

## Remaining proposed UI retirement candidates

| UI / path | Decision needed | Why |
|---|---|---|
| `/accounting/payments` | Keep historical read-only view and explicitly replace manual EUR/USD entry before removing | May be needed for legacy payments and manual FX |
| `/accounting/reports` legacy P&L, Balance Sheet, Cash Flow tabs | Migrate to reconciled report framework after accountant validation | Historical views can disagree with Phase 2J |
| Legacy invoice creation/edit actions inside `/accounting/invoices` | Audit each action and distinguish from controlled EGP invoice booking | Removing entire invoice view would break active controlled workflow |
| Legacy payment deletion endpoints/UI | Business owner and accountant review, likely replace with audited reversals | Deleting already-posted transactions can cause audit gaps |
| Legacy accounting endpoints | Separate API deprecation plan and permissions regression tests | Other modules may still call them |

## Manual UI smoke test

- Accounting sidebar shows **Simple Accounting**, **Chart of Accounts**, **Journal Entries**, **Invoices**, **Financial Reports**, **Reconciliation Dashboard**, **Bank Reconciliation**, and **Production Readiness** as applicable by role; **Payments** is not an everyday navigation item.
- Simple Accounting Money In / Money Out / Transfer still function against verified disposable `kora_test`.
- `/accounting/payments` direct URL shows **Legacy Payments**, not an apparent replacement for controlled supplier booking.
- Financial Reports clearly label which tabs are legacy and which is the Phase 2J local EGP preview.
- Open an invoice and confirm the controlled supplier booking/payment flow remains available according to existing pilot flags and roles.
- Existing historical payment, journal and invoice data remain unchanged.

## Branch safety

As of this work, draft PR #10 `feature/accounting-redesign` → `main` was reported not mergeable due to branch divergence. Do not merge, deploy, migrate the production DB or enable local-only accounting flags on production as part of UI cleanup.
