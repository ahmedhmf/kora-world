# Supplier Purchasing → Invoices → Payments → Journals: Read-only Audit

**Date:** 2026-11-11
**Branch inspected:** `feature/accounting-redesign`
**Scope:** source review only. No production changes, migrations, DB commands, or financial posting changes executed.
**Status:** Risks identified in code; whether existing records are duplicated requires separate, read-only analysis in the intended test environment.

## Current data flow

1. `POST /purchase-orders` → `PurchaseOrdersService.create` → stores PO, supplier, lines, currency, shipping. **No automatic journal from creating PO.**
2. `POST /invoices` → `InvoicesService.create`: stores invoice/lines. If status is `sent` or `paid`, calls `generateJournalEntry`.
3. `PUT /invoices/:id` → `InvoicesService.update`: persists update; for any `sent` or `paid` status, calls `generateJournalEntry` again; checks for prior invoice and payment journals using `findAllJournalEntries`.
4. `POST /payments` → `PaymentsService.create`: saves payment, calculates invoice paid status based on all linked payments, calls `InvoicesService.update`, and then creates a journal via `generatePaymentJournalEntry`.
5. `POST /accounting/journal/po-payment` → `JournalService.createPOPaymentEntry`, directly creates debit AP 2100 / credit selected bank; `POST /accounting/journal/po-receipt` → inventory 1300 / AP 2100. These endpoints are separately accessible to authenticated users and not linked to a saved Payment record.
6. `DELETE /payments/:id` deletes payment and invokes `deleteJournalEntryByReference(reference || PAY-id)`; update of an associated invoice can itself generate additional journals depending on status.

## Verified code-level risks

### P0 — Double posting when an invoice becomes paid via a Payment
- `PaymentsService.create` saves payment and calls `InvoicesService.update(invoice.id,{status:'paid'})` after payment total reaches invoice total.
- `InvoicesService.update` calls `generateJournalEntry`. For `paid` invoices it creates `invoice.number + '-PAY'` journal if absent.
- Back in `PaymentsService.create`, `generatePaymentJournalEntry` creates an additional `PAYMENT` journal with its own reference and debit to `categoryAccountId`/credit `paidFromAccountId`.
- The two journals can represent the same cash movement. For an invoice-linked supplier payment, the second category debit may double-count an expense rather than settle AP. The exact manifestation depends on the category selected and existing entries.

### P0 — Non-atomic multi-table writes
- Payment is saved first, invoice status is updated next, and journal posting happens afterward with no enclosing transaction. Failure partway may leave payment saved with no matching journal, or an invoice status/journal mismatch.
- Invoice create/update also persists invoice before journal generation.

### P0 — Reference-based deletion may delete wrong journal
- `PaymentsService.remove` deletes the payment then calls `AccountingService.deleteJournalEntryByReference`.
- `deleteJournalEntryByReference` finds **one** journal using nonunique `reference` and physically deletes it.
- If a reference collides or the associated journal cannot be found, payment and journal history may diverge. This bypasses the new reversal workflow/audit intention.

### P1 — Invoice PAID is overloaded as a posting trigger
- `InvoicesService.generateJournalEntry` creates both invoice booking and synthetic payment booking for status PAID, whether or not a linked Payment record exists.
- `allEntries.find` is an application-level lookup without database-enforced unique source key for these legacy journals, susceptible to duplicates in concurrent requests.
- Updating a posted invoice's amounts, currency, or type does not reverse/repost the original booked amount; existing booking is simply skipped if found.

### P1 — Multiple parallel PO posting paths
- Purchase order create/update itself doesn't post; separate `po-payment` and `po-receipt` endpoints directly post journals and have no uniqueness condition per physical payment/receipt.
- PO-linked payments additionally post via `PaymentsService.create`. It is therefore possible to record overlapping financial events through different routes.

### P1 — Account semantics of linked payment
- `PaymentsService.generatePaymentJournalEntry` always debits `categoryAccountId` and credits `paidFromAccountId`, even when `invoiceId` or `poId` is provided.
- For a booked supplier invoice, settlement should generally debit AP (not expense/COGS again). This needs exact business-case design and validation, not just a UI change.
- Invoice booking hardcodes accounts 5100, 2200, 2100; paid invoice posting selects bank 1101/1102/1103 using currency, not the recorded payment's bank account.

### P1 — Authorization / trust boundary
- `PaymentsController` and `InvoicesController` apply `AuthGuard` but no role-specific restrictions on creating/deleting financial records.
- `JournalController` exposes PO payment/receipt posting to any authenticated user via `AuthGuard`. This bypasses admin/approval business workflow.

### P2 — Currency scope mismatch
- Legacy invoice/payments support foreign currencies and rates; new `AccountingPostingService` and `SimpleAccountingService` are EGP-only. Migrate in a staged way; never silently treat USD/EUR as EGP.
- The old `AccountingService.createJournalEntry` tolerates/adjusts <=0.02 EGP rounding differences. New engine requires exact integer-cent balance.

## Recommended migration design (not implemented)

1. **Freeze manual overlap in UX guidance**: business-related supplier payments should use only the current Payments/Invoice area while work is ongoing; Simple Accounting explicitly excludes invoice/PO payments.
2. **Data audit before edits**: read-only counts of payments tied to supplier invoices, posted journals by `invoice_id`/`po_id`/`reference`, duplicates of `invoice.number + '-PAY'`, payments without journals, journals without payments, and account/date/currency mismatches. Preserve existing rows.
3. **Decide authoritative events**: invoice approved/issued = liability booking; actual Payment row = cash settlement; goods receipt = inventory event (only when a receipt is actually recorded), not just PO creation/status change.
4. **Introduce server-side event identity** (e.g. `payment:<id>:posted:v1`) and database uniqueness; bank/category/account mappings must be validated by payment purpose; customer side not in scope.
5. **Transactional posting**: payment creation and journal posting together in one DB transaction, with invoice settlement recalculation; refunds/corrections via reversal, not destructive reference deletion.
6. **Remove/disable implicit `PAID` synthetic cash posting** only after adding regression tests and implementing migration/compatibility protection for existing records. Do not retroactively delete old entries.
7. **Restrict manual PO journal routes** using server permissions and reconcile their use before disabling.
8. **Keep foreign currencies untouched** until explicit FX journal rules and tests have been designed.
9. **Reconcile trial balances** before/after using `kora_test` only. Never run automatic migration against `kora_world` or production without explicit consent.

## Read-only inspection queries for a verified disposable DB

These are examples only; verify DB host/name and actual column names before running. None should be run automatically by the API. Do **not** execute these against production.

```sql
-- Linked supplier payments by invoice (payments may be partial)
SELECT p.invoice_id, COUNT(*) AS payment_count, SUM(p.amount_egp) AS total_egp
FROM payments p JOIN invoices i ON i.id = p.invoice_id
WHERE i.type = 'incoming'
GROUP BY p.invoice_id
ORDER BY p.invoice_id;

-- Multiple payment journals attached to the same invoice
SELECT j.invoice_id, COUNT(*) AS payment_journal_count,
       STRING_AGG(COALESCE(j.reference,'(none)'), ', ' ORDER BY j.id) AS references
FROM journal_entries j
WHERE j.type = 'payment' AND j.invoice_id IS NOT NULL
  AND j.posting_status IN ('posted','reversed')
GROUP BY j.invoice_id
HAVING COUNT(*) > 1
ORDER BY j.invoice_id;

-- Legacy journal references that occur multiple times
SELECT j.reference, COUNT(*) AS count
FROM journal_entries j
WHERE j.reference IS NOT NULL
GROUP BY j.reference
HAVING COUNT(*) > 1
ORDER BY count DESC;
```

**Note:** Two journals per invoice can be legitimate for instalments or reversals, so results are investigation candidates, not proof of duplication.

## Files reviewed
- `api/src/purchase-orders/purchase-orders.service.ts`
- `api/src/purchase-orders/purchase-orders.controller.ts`
- `api/src/invoices/invoices.service.ts`
- `api/src/invoices/invoices.controller.ts`
- `api/src/payments/payments.service.ts`
- `api/src/payments/payments.controller.ts`
- `api/src/accounting/accounting.service.ts`
- `api/src/accounting/journal.service.ts`
- `api/src/accounting/journal.controller.ts`
- `api/src/accounting/entities/journal-entry.entity.ts`
- `api/src/accounting/entities/accounting-account.entity.ts`
- `api/src/accounting/accounting-posting.service.ts`

**Next implementation gate:** Agree on event semantics and review local `kora_test` audit results before modifying legacy payment posting or accounting balances.
