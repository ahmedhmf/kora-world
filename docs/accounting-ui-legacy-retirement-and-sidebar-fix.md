# Kora World Accounting UI — Legacy Retirement and Sidebar Fix

**Branch:** `feature/accounting-redesign` only. **Production:** untouched. **Main:** untouched.

## User-reported problems

1. Older Payments and Financial Report views remained accessible after the accounting redesign.
2. Accounting submenu was open immediately on page load.
3. Reopening Accounting could show blank labels until clicking elsewhere.

## Implemented changes

### Legacy Payments UI — fully removed
- Removed `/accounting/payments` from `web/src/app/app.routes.ts`.
- Deleted `web/src/app/features/accounting/payments.component.ts`.
- Deleted `web/src/app/features/accounting/payments.component.html`.
- Sidebar link had already been removed. No legacy Payments screen remains in this frontend route tree.
- The new `/accounting/simple` and invoice-specific controlled flows remain.

### Legacy Financial Reports UI — fully removed
- Deleted the legacy Profit & Loss, Balance Sheet and Cash Flow sections from `web/src/app/features/accounting/reports.component.html`.
- Deleted the legacy tab state, currency picker and old store-based report calls from `reports.component.ts`.
- `/accounting/reports` now renders **only** the existing controlled Phase 2J EGP report in local testing; when that report isn't eligible, it does not silently fall back to legacy figures.
- Account, journal, invoice, bank reconciliation and production-readiness screens remain because they support current workflows.

### Sidebar submenu behavior
- The initial `openSubmenus` state is empty: all submenu groups, including Accounting, start closed.
- Clicking a group toggles it; the toggle explicitly triggers change detection.
- Submenu labels remain in the mounted DOM instead of destroying/recreating the nested link tree each time; the container toggles a CSS `hidden` class.
- `aria-expanded` reflects the open/closed state of each submenu button.

## Scope / financial safety

This is a **frontend UI retirement**, not a database or accounting ledger deletion.
- No financial transactions, payment history, invoices, journals, bank rows, migrations, or schema objects were deleted.
- Legacy backend endpoints are not removed: other modules and historical integrations may depend on them. A separately reviewed API-deprecation / authorization exercise is required to stop obsolete API writes safely.
- Invoice UI was not deleted: the controlled booking flow uses the existing invoice view and record creation.
- Legacy manual EUR/USD **Payments page** is no longer available. Historical manual FX data remains in the backend, but any future manual-FX entry workflow requires review/implementation before use.
- Existing bank and finance pilot flags still restrict controlled new functions to the disposable local `kora_test` database.
- Draft PR #10 toward `main` remains separate and was previously reported unmergeable; this work does not merge or deploy anything.

## Manual UI verification on local branch

```powershell
cd D:\Ahmed\project\kora-world
git pull --ff-only origin feature/accounting-redesign
cd web
npm run build
```

1. Fresh reload at `/dashboard`: Accounting submenu should start **closed**.
2. Click Accounting: labels should be visible **immediately**, without clicking the black background.
3. Close and reopen Accounting repeatedly; labels should always render immediately.
4. Confirm the Accounting sidebar contains Simple Accounting, Chart of Accounts, Journal Entries, Invoices, Financial Reports, and role-appropriate reconciliation sections. No old generic Payments link.
5. Navigate to `/accounting/payments` directly: the deleted screen must not render.
6. Open Financial Reports: only the controlled local EGP report should appear; no legacy Profit & Loss, Balance Sheet or Cash Flow tabs.
7. Verify Simple Accounting, the existing invoice-specific controlled supplier payment UI, and Journal Entries remain available in `kora_test`.
8. Verify Sourcing & Development and Commercial Operations menus also toggle and display labels normally.
9. No backend or production verification is implied by a successful frontend build.

**Note:** Angular template and browser tests were not executed remotely by the assistant. Run the local UI checks above to verify the user's reported blank-label issue is resolved in their browser.
