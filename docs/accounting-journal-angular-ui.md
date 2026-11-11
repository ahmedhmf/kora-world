# Journal Entries UI — Manual approval workflow

Branch: `feature/accounting-redesign`. **Not deployed.**

## New behavior

The Angular route `/accounting/journal` now:
- Lists journal entries, with filters for All / Drafts / Awaiting Approval / Posted / Reversed.
- Displays source amounts and EGP base totals, journal detail lines, actor IDs, posting timestamps, and reversal links.
- Allows authenticated employees to create EGP-only manual journal drafts from eligible active leaf accounts.
- Allows the draft owner to submit their draft.
- Allows a distinct accountant or administrator to approve and post pending journals.
- Allows accountants/administrators to reverse posted manual journals with a mandatory reason.
- Shows errors and operation progress, and reloads the history after changes.
- Does not provide manual FX entry or attachment upload yet (existing attachments on historical entries are viewable).

### APIs
- `GET /accounting/manual-journals` returns role-aware history, including the associated accounts/lines.
- Employees see their own journals (any status) plus posted/reversed history.
- Accountants and admins can view all, including others' pending entries.
- Existing `GET /accounting/journal-entries` is also now role-aware.
- `POST /accounting/manual-journals/drafts`
- `POST /accounting/manual-journals/:id/submit`
- `POST /accounting/manual-journals/:id/approve`
- `POST /accounting/manual-journals/:id/reverse`

Server-side permission checks are authoritative and re-read the current database role.

## Local verification

```powershell
cd D:\Ahmed\project\kora-world
git switch feature/accounting-redesign
git pull --ff-only origin feature/accounting-redesign

cd api
npm run build
npm test -- --runInBand journal-workflow.service.spec.ts
npm test -- --runInBand accounting-posting.service.spec.ts

cd ..\web
npm run build
```

To manually exercise the screen in a local development environment, apply the approval-workflow migrations to your **local development database only after verifying the target and backing it up**, then start the local dev API and Angular app. **Do not deploy this branch to production.** `api/src/app.module.ts` sets `migrationsRun: true` on application startup.

For the already isolated test database:

```powershell
cd ..\api
$env:DATABASE_NAME = 'kora_test'
$env:DATABASE_HOST = '127.0.0.1'
node -r ts-node/register scripts/prepare-accounting-test-db.js
npm run test:accounting:integration
```

## Manual acceptance scenario
1. Log in as employee A; open Accounting → Journal.
2. Create a draft using two active leaf EGP accounts and balanced amounts.
3. Confirm draft appears in Drafts with no posted timestamp.
4. Submit it; it moves to Awaiting Approval; employee cannot approve.
5. Log in as accountant B (distinct user); approve and post it.
6. Check Posted and expand the row; confirm approver and EGP values.
7. Reverse with a reason; confirm original becomes Reversed and the opposite posted journal appears.
8. Check ledger/report balance; the combined effect of original and reversal is zero.
9. Verify employees cannot see other employees' unposted drafts.

## Limitations
- The 29 existing seeded accounts have not been redesigned. Manual entries require EGP leaf accounts.
- User roles must exist as `employee`, `accountant`, or `admin` in existing users.
- This is **manual-journal** workflow only; legacy PO, invoice, and payment integration is not rebuilt.
- Other old posting/delete code paths still need immutability protections.
- Fiscal period locks, approval queues at scale, business document attachments, and correcting an existing draft are future work.
- Build and browser/runtime verification must be completed locally; this GitHub update does not run local tests or migrations.
