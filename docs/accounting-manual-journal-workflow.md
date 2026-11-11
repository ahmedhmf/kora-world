# Accounting Redesign — Manual Journal Approval Workflow

Branch: `feature/accounting-redesign`  
Implementation: backend-only milestone; not a replacement for the entire accounting module.  
Status: committed, **requires local build / unit and PostgreSQL integration validation**.

## Scope

An employee creates a manual EGP journal as a `draft`, then submits it to `pending_approval`. An accountant or administrator who did not create/submit that journal can approve and `post` it. An accountant or administrator can `reverse` a posted manual journal by adding a linked opposite journal entry; the original is marked `reversed`. Existing invoice/payment posting is **not** migrated to this workflow.

### Permissions
- Authenticated existing user: create a draft, submit their **own** draft.
- Current `accountant` or `admin` role from the users table: approve, reverse.
- No self-approval, including for admins.
- User ID is taken from the authenticated request, never from client-supplied body fields.
- Maker-checker is enforced in the service within a locked, transactional workflow.

### Endpoints
Authenticated session required on each.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/accounting/manual-journals/drafts` | Create draft |
| POST | `/accounting/manual-journals/:id/submit` | Creator submits draft |
| POST | `/accounting/manual-journals/:id/approve` | Separate accountant/admin approves and posts |
| POST | `/accounting/manual-journals/:id/reverse` | Accountant/admin reverses posted manual journal |

Example draft JSON (EGP cents, **not pounds**):
```json
{
  "date": "2026-11-11",
  "description": "Transfer between two EGP accounts",
  "reference": "MAN-001",
  "lines": [
    { "accountId": 12, "debitCents": 15000, "creditCents": 0 },
    { "accountId": 19, "debitCents": 0, "creditCents": 15000 }
  ]
}
```
The account IDs above are *illustrative*; use active **leaf** EGP accounts in your own database. Approval requires the amounts to be balanced and the accounts still active.

Reversal JSON:
```json
{ "reason": "Incorrect account allocation" }
```

### Legacy route behavior
The two legacy manual posting endpoints now return HTTP 410 Gone rather than bypass the approval:
- `POST /accounting/journal-entries`
- `POST /accounting/journal/manual`

**The existing Angular manual journal creation screen uses a legacy endpoint and must be updated before users can create drafts through the UI.** This is an intentional breaking change in the accounting redesign branch only.

### Database changes
New additive migration: `1794441600000-AddJournalApprovalWorkflow.ts`
- Adds `created_by_id`, `submitted_by_id`, `submitted_at`, `approved_by_id`, `reversed_by_id`, `reversed_at` to `journal_entries`.
- User references are nullable for compatibility with existing postings.
- Unique filtered index `uq_journal_one_reversal` prevents multiple reversal journals for one original.
- Existing `posting_status`, `source_event_key`, `reversal_of_id`, `posted_at` from the previous migration remain in use.

### Reporting
Manual draft/pending entries must never affect balances. The existing Ledger and Profit & Loss, Balance Sheet and Cash Flow queries now include status `posted` and `reversed`, and exclude draft/pending. We intentionally include the original reversed entry **and** its linked posted reversal so their combined effect is zero; excluding the original alone would produce an erroneous opposite balance.

Existing multi-currency and other reporting bugs identified in the audit are **not fixed** by this milestone.

## Local verification (PowerShell)

From `D:\Ahmed\project\kora-world\api`:
```powershell
git switch feature/accounting-redesign
git pull --ff-only origin feature/accounting-redesign

npm run build
npm test -- --runInBand journal-workflow.service.spec.ts
npm test -- --runInBand accounting-posting.service.spec.ts

$env:DATABASE_NAME = "kora_test"
$env:DATABASE_HOST = "127.0.0.1"
node -r ts-node/register scripts/prepare-accounting-test-db.js
npm run test:accounting:integration
```

The preparation script refuses any database name other than **kora_test** and refuses remote hosts. It may execute pending repository migrations **only** in the local disposable test DB. Do not run the application with this branch in production: the application automatically runs migrations at startup.

Expected tests: 11 workflow unit tests and 4 PostgreSQL integration tests, plus the prior five posting-service unit tests. Results must be verified locally; no claim of execution is made here.

## Remaining work before this is production-ready
- Angular UI for create/submit/review/approve/reverse plus status/history.
- Period locks, accounting-specific grants, approval thresholds and role provisioning.
- Immutable posted journals enforced across **all** legacy write/delete code paths and ideally at the database boundary. Current restrictions apply to the new workflow path, not universally.
- Replace old invoice/payment/PO posting routes with transactional, idempotent accounting events; avoid their duplicate journal creation.
- Multicurrency journal posting, FX revaluation and accounting policy decisions.
- Trial Balance and corrected GL summaries; existing reporting still has unresolved historical FX and cash-flow issues.
- Explicit audit/event log, source-event integration tests and end-to-end frontend tests.
