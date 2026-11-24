# Kora World Accounting Redesign — Phase 1 Foundation

Status: DESIGN / AUDIT — no data reset or deployment authorized by this document.
Branch: feature/account-payment-models
Date: 2026-11-11

## Objective
Build a complete internal double-entry accounting system for employees and accountants, integrated with supplier invoices, customer invoices, payments, inventory, purchase orders, delivery notes, consignment settlements, and customer advances. Reuse NestJS, Angular, TypeORM, and PostgreSQL. Keep this as a modular monolith.

## User decision and data boundaries
The existing accounting module has not been used; its **accounting-only data** may be discarded during a controlled reset. This is not permission to delete operational data.
- Candidate reset data (after dependency verification): accounting_accounts, journal_entries, journal_lines, exchange_rates.
- DO NOT reset without explicit verification: invoices, invoice_lines, payments. They link to suppliers, purchase_orders, and the accounting schema; determine whether either contains operational data first.
- Preserve: suppliers, products, purchase_orders, inventory, delivery_notes, weekly_sales_reports, customer_pricing_rules, sales_settlements, customer_payments, payment_allocations, customer_statements, accounts, receipts, and unrelated business tables.
- Never run reset against production without an explicit, environment-specific authorization and backup.

## Verified code concerns (source review, not runtime validated)
1. api/src/invoices/invoices.service.ts: invoice status PAID generates a payment posting, while api/src/payments/payments.service.ts also posts the actual payment. Risk of double posting.
2. Invoice and payment records are saved before subsequent journal posting, with no outer transaction coordinating document and ledger writes.
3. Updating/deleting previously posted invoices does not implement journal reversal and controlled re-posting.
4. api/src/accounting/journal.service.ts aggregates original debit/credit values for account balances even when multi-currency lines exist.
5. api/src/accounting/reports.service.ts silently substitutes an EGP amount when target-currency conversion fails; Balance Sheet omits undistributed current earnings; Cash Flow sums selected bank lines in original currency.
6. api/src/accounting/accounting.service.ts adjusts rounding by modifying the last line's original-currency debit or credit, risking mismatch between original and base amounts.
7. Frontend journal entry validation says EUR while the backend balances EGP.
8. 1750000000006-CreateAccountingTables.ts seeded EUR accounts; 1750000000011-EGPBaseCurrency.ts renamed 1101 to EGP bank and inserted 1104 USD and 1105 EUR; 1750000000024-AddOwnerCapitalAccounts.ts later seeded EUR capital accounts. Account-code/currency conventions are inconsistent.
9. Current API controllers generally use AuthGuard without accounting-specific role/approval permissions.
10. Core accounting journals have no explicit draft/posted/reversed lifecycle or immutable source-event identifier.

## Architecture target
Operational workflows -> approved domain event -> central posting service -> immutable journal header/lines -> General Ledger -> Trial Balance -> Profit & Loss / Balance Sheet / Cash Flow.

### Core rules
- One unique posting key for each business event (source type + source id + event type + source revision). Reject duplicates using database unique constraints, not only application checks.
- Document status update, posting event, and GL records must commit in a single database transaction for synchronous flows. If asynchronous, use transactional outbox and idempotent consumers.
- Post only fully balanced entries in base currency. Never silently accept currency conversion failure.
- Preserve source currency, rate, rate date, base amount, and base currency on each journal line. Monetary arithmetic uses exact decimal or integer minor units.
- Finalized journals are append-only; corrections produce linked reversals/new postings.
- Restrict postings to open fiscal periods with audited privilege checks.
- Operational source modules own their documents; accounting owns posting truth. Do not let both invoice status and payment recording independently book the same cash event.
- Use account mapping rules instead of globally hardcoded account codes in business services.
- Account balances and reports use POSTED entries only.

## Suggested initial implementation order
1. Inventory every accounting-related API/Angular service and migration. Inspect database schema and counts *read-only* before deletion.
2. Build a test-only PostgreSQL integration harness with an exact database-name allowlist and no access to development/production databases.
3. Add transactional posting service, unique event key, balanced-entry validation, and tests for retries/concurrency.
4. Replace duplicate invoice/payment posting with a single authoritative payment event; add full and partial payment tests.
5. Implement journal posting state, irreversible audit records, and reversal workflow.
6. Normalize bank/account currency metadata and replace obsolete seeded Chart of Accounts in an additive versioned migration.
7. Fix account ledger, trial balance, current earnings, FX handling, and cash-flow classification.
8. Test complete invoice -> receipt -> allocation -> reversal and purchase -> goods receipt -> supplier invoice -> payment flows.

## Tests and acceptance
- Failed posting rolls back all document and ledger state.
- Repeating a source event creates exactly one posted journal.
- Concurrent duplicate requests cannot duplicate postings.
- Journal debit and credit base totals match to the smallest accounting unit under a documented rounding policy.
- Posted journals cannot be updated/deleted; reversals are traceable and equal/opposite.
- Invoice, payment and settlement subledgers reconcile to their GL control accounts.
- Trial Balance is balanced; Balance Sheet includes earnings and balances.
- FX conversion never falls back to an unlabeled 1:1 rate.
- Full test suite runs on test-only database; no destructive migration on shared or production DB.

## Open accounting policy decisions
Confirm legal entity/jurisdiction; reporting framework; fiscal year; whether EGP is authoritative base currency; inventory valuation; consignment principal/agent and revenue recognition; VAT treatment; maker-checker thresholds; whether multiple entities or branches are needed. Do not hardcode speculative tax or recognition policy.

## Rollout
Development branch only. No production deployment or database reset as part of this plan. A future migration must verify environment, back up, enumerate dependent FKs, compare row counts, and explicitly allowlist affected tables.
