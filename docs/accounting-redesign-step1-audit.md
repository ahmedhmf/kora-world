# Accounting Redesign — Step 1: Source and Migration Dependency Audit

**Date:** 2026-11-11  
**Branch:** `feature/accounting-redesign`  
**Status:** Source-code audit complete for the files listed below. Live database contents and migration state **not inspected**.  
**Action:** Documentation only; no DB mutation or application behavior change.

## Scope and separation

The existing accounting module is unused according to the product owner, who permits discarding accounting-only data. Preserve operational business data and preserve the separate customer-financials system unless separately reviewed.

### Accounting domain / old accounting flow
- `api/src/accounting/entities/accounting-account.entity.ts` → `accounting_accounts`
- `api/src/accounting/entities/journal-entry.entity.ts` → `journal_entries`
- `api/src/accounting/entities/journal-line.entity.ts` → `journal_lines`
- `api/src/accounting/entities/exchange-rate.entity.ts` → `exchange_rates`
- `api/src/invoices/entities/invoice.entity.ts` → `invoices`
- `api/src/invoices/entities/invoice-line.entity.ts` → `invoice_lines`
- `api/src/payments/entities/payment.entity.ts` → `payments`

### Distinct customer-financials domain (preserve)
- `api/src/delivery-notes/customer-financials.service.ts` operates on `SalesSettlement`, `CustomerPayment`, `PaymentAllocation`, `CustomerPricingRule` and `WeeklySalesReport`, tied to business accounts/products.
- This is *not* the same payment model as `api/src/payments/payments.service.ts`. No schema reset must touch these entities, their tables, or their operational records.

## Source dependency matrix

| Object | References / relationships | Reset policy |
| --- | --- | --- |
| `accounting_accounts` | Self-referencing `parent_id`; referenced by `journal_lines.account_id` and `payments.paid_from_account_id` / `payments.category_account_id` with RESTRICT delete behavior | Reset only after checking all references, and in explicit child-to-parent order |
| `journal_entries` | Optional `po_id` and `invoice_id` links; `journal_lines` child records cascade on delete | Candidate for reset, but inspect provenance first |
| `journal_lines` | FK to `journal_entries` and `accounting_accounts` | Candidate for reset, after validating database |
| `exchange_rates` | Date/currency unique constraint; operational invoice UI calls exchange-rate service for product price conversion | Avoid blind deletion; exchange rates may affect non-accounting product/invoice UI workflows |
| `invoices` | Optional supplier and purchase-order FKs; referenced by `invoice_lines`, `payments`, and `journal_entries` | Not automatically disposable; verify records and operational use first |
| `invoice_lines` | Child of `invoices` | Never reset independently until invoice ownership confirmed |
| `payments` | Optional invoice and purchase-order FKs; account FKs to `accounting_accounts` | Not automatically disposable; verify records and operational use first |
| `sales_settlements`, `customer_payments`, `payment_allocations` | Separate customer-account financial workflow | PRESERVE |
| `purchase_orders`, `suppliers`, `products`, delivery and inventory tables | Operational sources connected indirectly/through invoices, entries, payments | PRESERVE |

## Read source files

- `api/src/app.module.ts`: imports AccountingModule, InvoicesModule, PaymentsModule, DeliveryNotesModule; TypeORM uses `migrationsRun: true`, `synchronize: false`.
- `api/src/accounting/accounting.module.ts`: circular `forwardRef` dependencies with InvoicesModule and PaymentsModule.
- `api/src/accounting/accounting.service.ts`, `journal.service.ts`, `reports.service.ts`.
- `api/src/accounting/accounting.controller.ts`, `journal.controller.ts`, `reports.controller.ts`.
- `api/src/invoices/invoices.service.ts`, `invoices.controller.ts`, invoice entity.
- `api/src/payments/payments.service.ts`, `payments.controller.ts`, payment entity.
- `api/src/delivery-notes/customer-financials.service.ts`.
- `api/src/migrations/1750000000006-CreateAccountingTables.ts`.
- `api/src/migrations/1750000000011-EGPBaseCurrency.ts`.
- `api/src/migrations/1750000000023-AddDetailsToPayments.ts`.
- `api/src/migrations/1750000000024-AddOwnerCapitalAccounts.ts`.
- `api/data-source.ts`.

### Migration findings

1. Migration `0006` creates accounting accounts, invoices, invoice lines, journals, payments, and exchange rates; seeds the initial Chart of Accounts in EUR.
2. Migration `0011` migrates amount columns to `amount_base`, adds `amount_egp`, changes many account currencies to EGP, renames account `1101`, and adds `1104` USD and `1105` EUR bank accounts.
3. Migration `0023` adds invoice/payment categories and account FKs to `payments`, which block deleting referenced accounting accounts.
4. Migration `0024` creates owner capital subaccounts with EUR currency (even after previous EGP conversion).
5. **Do not edit historical migrations that may already have executed.** Implement new corrective migrations. Given `migrationsRun: true`, a newly committed migration may run at API startup in any environment that deploys it.

### Code issues to correct in subsequent implementation

1. Invoice status becoming PAID generates an invoice-level payment journal; `PaymentsService.create()` separately generates a payment journal: duplicate or inaccurate posting risk.
2. Saving a business document and recording its accounting journal are not protected by one shared database transaction.
3. Journal deletion by reference is destructive and may collide with external references; posted entries require reversals.
4. Financial reporting and ledger balances sometimes use raw amounts instead of base amounts; FX fallback can silently mislabel amounts.
5. Backend base-currency accounting is EGP; frontend journal UI still mentions EUR; bank account seed codes are inconsistent.
6. No posted/draft/reversed journal lifecycle, source-event uniqueness, or period locking.
7. Invoices and payments controllers require authentication but show no accounting-specific authorization policy.

## Required live database audit before any reset

Run **read-only** queries in an explicitly identified local or test database. Do not assume `kora_test` contents are representative of development or production.

1. Print `current_database()`, `current_user`, `inet_server_addr()`, and `inet_server_port()`.
2. List migration history and inspect exact tables/columns/constraints using `information_schema` and `pg_catalog`.
3. Count rows in `accounting_accounts`, `journal_entries`, `journal_lines`, `exchange_rates`, `invoices`, `invoice_lines`, `payments`.
4. Check all foreign keys referencing these seven tables, including references from unrelated tables.
5. Count operational records and preserve separately: customer settlements/payments/allocations, delivery notes, purchase orders, inventory, accounts.
6. Determine whether any invoices/payments/exchange rates are currently used in operational workflows.
7. Obtain a rollback-capable backup for the target environment before any future reset.
8. For tests, enforce exact database allowlist `kora_test` (prefer an independent disposable Postgres instance); never run data-reset commands against `kora_world` or production.

## Step 1 acceptance and next step

- [x] New accounting-specific Git branch.
- [x] Code-level ownership and FK dependency audit (above).
- [x] Migration inspection for major accounting schema changes (above).
- [ ] Live database schema/FK/row-count audit (not performed, no database connection available through GitHub).
- [ ] Full migration inventory and source-event mapping beyond the reviewed files.
- [ ] Sign-off on legal entity, base currency, financial reporting framework.

**Next implementation step:** complete read-only DB inspection, then add a central posting service and automated PostgreSQL integration tests on this branch. No reset or production deployment until separately authorized for that environment.
