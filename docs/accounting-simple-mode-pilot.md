# Simple Accounting — Initial Pilot

Branch: `feature/accounting-redesign`. **Not deployed. Changes committed; local build and tests not yet run.**

## What it does
Adds **Accounting → Simple Accounting**, routing `/accounting/simple` (also the default `/accounting` route). Three EGP-only actions:

| Action | Debit | Credit |
| --- | --- | --- |
| Money Out (standalone expense) | Active expense-category account | Cash / bank account |
| Money In (other income) | Cash / bank account | Active revenue-category account |
| Transfer | Destination cash / bank account | Source cash / bank account |

The user enters date, description, amount in EGP, money account and a business category (or destination). **No debit/credit entry is required.**

Backend `POST /accounting/simple/transactions` computes journal lines itself and checks selected accounts are active, EGP-denominated, leaf accounts with appropriate types. Cash and bank accounts are currently identified by code prefix **11** per the legacy chart convention. Confirm the actual Kora World chart complies before using.

- Admin: draft → submit → approve and post automatically, using the journal workflow actor audit fields.
- Employee/accountant: draft → submit as pending; Admin reviews it under the existing Journal Entries interface.
- Supplier: prohibited.
- The journal remains visible under Accounting → Journal Entries.
- No new database migration or seed data.

## Deliberate exclusions — important
**Do not use Simple Accounting to record** payments tied to purchase orders, supplier invoices, existing customer invoices, delivery notes, customer settlements, or other existing business records. Their separate posting paths have not been reconciled with this new workflow. Recording the same transaction here may cause duplicate amounts in reports. Use the existing dedicated workflow for those until integration is completed.

This first slice has **no** support for tax, VAT, receivables, payables, loan movements, inventory movements, accruals, attachments, or foreign currencies. It also does **not** redesign historical seeded accounts or reconcile historical financial data.

## Current limitations before production use
- Three separate operations create/submit/post the admin's journal; a failure during submission/approval may leave a valid draft or pending journal. This is recoverable, but the whole operation is not one atomic transaction yet.
- No request-level idempotency key on the Simple Accounting form; a user repeating a successful request could record the same event twice. Do not retry a timed-out save until checking journal history.
- The existing journal workflow is not globally immutable across other legacy code paths.
- The `11xx` money-account convention must be reviewed against the real Chart of Accounts.
- User roles in the underlying authorization system remain broad; accounting-specific permissions are still limited.
- Do not deploy the feature branch until these limitations are addressed and the complete system is tested.

## Local verification

```powershell
cd D:\Ahmed\project\kora-world
git switch feature/accounting-redesign
git pull --ff-only origin feature/accounting-redesign

cd api
npm run build
npm test -- --runInBand simple-accounting.service.spec.ts
npm test -- --runInBand journal-workflow.service.spec.ts

cd ..\web
npm run build
```

Use only the local test/development environment already configured with the prior accounting migrations. No production or test DB modification is required for merely building.

Browser smoke test:
1. Sign in as Admin and open Accounting → Simple Accounting.
2. Confirm active EGP money accounts (11xx) and expense/revenue categories are offered.
3. In **a disposable test DB**, record Money Out for 200 EGP and confirm a posted journal with expense debit and bank credit.
4. Record Money In for 100 EGP, confirm bank debit and revenue credit.
5. Transfer 50 EGP between two cash/bank accounts; confirm source credit and destination debit, with no Profit & Loss effect.
6. Sign in as Employee, record an expense; confirm Pending Approval; sign back in as Admin and approve it.
7. Verify unsupported source/category account types are rejected.

**Do not enter actual transactions for customers/suppliers/POs through this form yet.**
