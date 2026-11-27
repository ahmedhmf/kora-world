# Phase 2I Part 2 — Unified accounting roadmap, manual currency policy

**Status:** Scope and non-destructive transition plan. No production changes or automatic FX feature.

## Product decision

**Phase 2K (automatic multi-currency accounting) is cancelled / excluded from the requested roadmap.** Currency rates and foreign-currency adjustments remain **manual** according to Kora World's established operational practice. Do not add automatic currency conversion, exchange-rate fetching, FX gain/loss auto-posting, or background revaluation in this workstream.

This does NOT mean stripping the existing manual currency and exchange-rate fields or rewriting historical EUR/USD entries. Financial records must preserve stored currency, manually entered rate and base-currency amounts.

## Why Phase 2I must be incremental

Current legacy paths inspected on development branch:
- `InvoicesService.generateJournalEntry()` posts an `INVOICE` journal, then posts a **synthetic full `PAYMENT` journal** whenever an invoice is marked `PAID`, regardless of a distinct verified Payment row.
- `PaymentsService.create()` persists a Payment, updates invoice status through `InvoicesService.update()` (which may trigger the synthetic journal), then separately calls `generatePaymentJournalEntry()`.
- `PaymentsService.remove()` still hard-deletes legacy payments and journal entries outside the explicit local EGP supplier pilot safety gate.
- `AccountingPostingService.post()` provides a narrow EGP, transactional journal posting primitive; legacy invoices/payments do not call it.
- `SupplierEgpPilotService` is the isolated, tested EGP settlement/reversal path on disposable `kora_test`.

A global find-and-replace would risk historical invoices showing `PAID` without corresponding cash movements, and could change EUR/USD manual workflows. Never silently backfill or delete journals.

## Required Phase 2I Part 2 implementation order

1. **Readonly audit/reconciliation** in isolated test DB: for each invoice classify invoice booking journals, real payment records, synthetic `<invoice-number>-PAY` journals, legacy payment-reference journals, controlled pilot journals, and reversals. Flag duplicate/ambiguous/missing links; do not repair automatically.
2. **Choose the canonical source**: an explicit, durable payment operation is the only source of a payment journal; changing invoice status alone is not a cash event. New journal entries must be created within the same transaction as corresponding payment record and invoice balance/status.
3. **Implement new controlled, idempotent, transactional EGP flows** for approved invoice/payment cases; preserve the existing supplier pilot's invariant checks. Reject mixed or ambiguous history instead of guessing.
4. **Add tests** for partial/full payments, duplicate submissions, concurrent requests, rollback, reversal, manual currency fields and no synthetic cash movements on status changes.
5. **Cut over one narrow workflow at a time** behind a default-off flag and explicit disposable `kora_test` identity checks. Keep legacy EUR/USD and manual-rate workflows intact until an explicit migration design is accepted.
6. Only after successful reconciliation and production deployment approval: prepare reviewed schema migrations, exact rollback/recovery procedures, and authorized historical adjustments (via auditable journals, not deletes).

## Excluded from this workstream

- Automatic FX conversion, automatic rates, foreign exchange gain/loss posting, periodic revaluation and scheduled remeasurement (formerly Phase 2K).
- Any change to the production DB, `main` branch, or actual company financial records without separate explicit approval.

## Next development work

Implement the **read-only reconciliation audit** first, then controlled booking/status posting changes. The audit must not run migration scripts or mutate real financial records. Full Phase 2I Part 2 is not yet implemented merely by accepting this plan.
