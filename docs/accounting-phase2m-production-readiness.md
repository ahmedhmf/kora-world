# Phase 2M — Accounting production-readiness implementation and release gate

**Scope:** Phase 2M-A through 2M-F, **development branch only** `feature/accounting-redesign`.

**Release status: BLOCKED.** No production migration, merge, deployment, data repair, production API toggle, or production database query was performed. Phase 2M is a verification and release-preparation system, NOT an authorization to turn on the experimental Phase 2A–2L workflows in production.

## 2M-A — Full accounting source audit

Implemented:
- `api/src/accounting/phase2m-readiness.policy.ts` — pure detection logic for ledger integrity, duplicate source events, posted journal balance, broken reversal chains, missing invoice/account links, and manual-currency review.
- `api/src/accounting/phase2m-readiness.service.ts` — read-only `REPEATABLE READ` snapshot, with explicit PostgreSQL `current_database() = 'kora_test'` verification; guarded by `ACCOUNTING_PHASE2M_AUDIT=true`, `DATABASE_NAME=kora_test`, and a loopback `DATABASE_HOST`.
- `GET /accounting/phase2m-readiness`, authenticated **admin only**.
- Angular **Accounting → Production Readiness**; local admin-only read-only findings, severity/search filtering, and JSON evidence export.

The audit includes `blocker` and `warning` findings and a proposed investigation. A result with zero findings **is not** release approval; `readyForProduction` is always false. No modifying operations exist in the endpoint.

**Source audit observations requiring separate review:** 
1. Production TypeORM startup currently has `migrationsRun: true` in `api/src/app.module.ts`. This must be replaced with an explicitly reviewed production migration procedure before enabling new accounting modules.
2. `1764300000000-Phase2LBankReconciliation.ts` creates staging tables **only in** `kora_test`. This is NOT a production-compatible migration. On other databases its `up` is a no-op; nevertheless TypeORM may record the migration as applied. A deliberately separate production migration and compatibility rehearsal is necessary.
3. The opening-balance feature refuses accounts with existing journal history. Existing bank accounts, including the account already used for the Marketing example, require a separately reviewed historical transition plan.
4. Phase 2J AR and legacy supplier payments can be marked unverified because historic records may lack controlled source-event links. Historical balances and duplicate journal cleanup are NOT automated.
5. Supplier invoice booking maps net expense to 5100, AP to 2100, and VAT handling to 2200. Finance must review local chart-of-accounts tax semantics (e.g. recoverable input VAT versus a tax liability), invoice types and date rules before migration.
6. Some reporting derives cash movements from asset accounts with `11` prefix. Confirm bank/cash account mapping and compare with external statements; zero report discrepancy is not independent bank confirmation.
7. Manual EUR/USD rates remain unchanged. Verify supporting historical rate evidence and already-recorded base amounts rather than introducing automatic FX.

**Not yet verified:** a complete repository-wide security/finance review of every legacy controller, migration and workflow, bank confirmation against external statements, financial certification of posting account choices, or test results from a production-like staging environment.

## 2M-B — Historical data reconciliation

The historical audit flags:
- `DUPLICATE_SOURCE_EVENT`, `INVOICE_BOOKING_COUNT`, `UNBALANCED_JOURNAL`, `EMPTY_POSTED_JOURNAL`, `INVALID_JOURNAL_LINE`, `MISSING_ACCOUNT`, `INVALID_BASE_AMOUNT`
- `ORPHANED_REVERSAL`, `BROKEN_REVERSAL_CHAIN`, `INCONSISTENT_REVERSAL_STATUS`
- `ORPHANED_PAYMENT_INVOICE`, `ORPHANED_JOURNAL_INVOICE`, `DUPLICATE_SUPPLIER_PAYMENT_POSTING`
- `LEGACY_SUPPLIER_PAYMENT_UNVERIFIED`, `MANUAL_FX_REVIEW`, `FOREIGN_CURRENCY_INVOICE`, `FOREIGN_CURRENCY_PAYMENT`

Review each finding with a finance owner, source invoice/payment/statement, proposed correction, and approval. Avoid automatic normalization or deletion. Keep both the Phase 2J reports and Phase 2J-D audit outputs as separate evidence; their snapshots are not necessarily atomic with the new Phase 2M snapshot.

**Historical correction acceptance record** (one row per issue):
| Finding ID/code | Source record | Business evidence | Proposed adjustment | Reviewer/approver | Reconciliation before/after | Sign-off |
|---|---|---|---|---|---|---|
| *To be populated with actual data* | | | | | | |

Never create a correction journal merely to force the Balance Sheet difference to zero.

## 2M-C — Production migration preparation

New migration code has **not** been authorized or applied to production. The present Phase 2L test-only migration is intentionally ineligible.

Before proposing a production migration:
1. Capture a verified production schema/TypeORM migrations inventory using an approved operator and read-only credentials; do **not** automatically run the app against production for this purpose.
2. Restore a recent production backup to an isolated **staging clone**. Remove/obfuscate sensitive data where necessary.
3. Compare the migration history and schema on the clone; identify whether any test-only migration has been recorded without creating its tables.
4. Prepare a new, separately reviewed, additive staging/production-compatible migration with constraints, rollback/forward-repair SQL, lock time estimates, and integrity checks.
5. Rehearse migration and rollback on the clone; measure downtime, table locks and data integrity. Capture pre/post counts and schema hashes.
6. Replace automatic production migration boot behavior with a separate migration release step only after engineering approval.
7. Require explicit owner approval before any production schema or application change.

The offline tool `api/scripts/phase2m-preflight.mjs` inspects static source and reports current known gaps. `--strict` intentionally exits nonzero if release blockers remain. It does not access databases or execute migrations.

## 2M-D — Security and permissions

Server-side role/flag safety checks remain the only authorization boundary; Angular menu visibility is not a permission control. Confirm in a staging environment:
- Anonymous and expired JWT → 401.
- Employee and accountant roles → denied for admin-only booking, opening, import, match/unmatch and Phase 2M audit.
- Accountant → allowed only for explicitly read-only reporting routes.
- Production database identity and non-loopback hosts → reject all local pilot endpoints.
- Missing/false pilot flags → 403.
- No indirect write path via legacy invoices, payments or manually posted journals bypasses the controlled posting gate.
- Concurrency, replay, booking and payment reversals still result in balanced, unique, audit-backed journal history.

**Caution:** These checks are not all covered by new Phase 2M end-to-end tests. They must be evidenced before approval.

## 2M-E — Automated and manual acceptance

Development/source CI workflow: `.github/workflows/accounting-phase2m-validation.yml`.
It has no database secrets, writes or deployment job. It performs backend/frontend builds, unit tests, and offline source preflight on development changes.

Local test commands:

```powershell
cd D:\Ahmed\project\kora-world
git pull --ff-only origin feature/accounting-redesign

cd api
npm run build
npm test -- --runInBand phase2m-readiness.policy.spec.ts phase2m-readiness.service.spec.ts phase2m-permissions.spec.ts phase2j-report.policy.spec.ts phase2l-bank.service.spec.ts
node scripts/phase2m-preflight.mjs
# Strict release gate is EXPECTED to fail until approved blockers are resolved:
node scripts/phase2m-preflight.mjs --strict

cd ..\web
npm run build
```

Run **only on verified disposable local `kora_test`**:

```powershell
cd D:\Ahmed\project\kora-world\api
$env:DATABASE_NAME = 'kora_test'
$env:DATABASE_HOST = '127.0.0.1'
npm run test:accounting:integration -- phase2m-readiness.integration.ts
npm run test:accounting:integration -- phase2l-bank.integration.ts
npm run test:accounting:integration -- phase2j-report.integration.ts
```

To use the read-only UI after confirming `kora_test`:

```powershell
$env:DATABASE_NAME = 'kora_test'
$env:DATABASE_HOST = '127.0.0.1'
$env:ACCOUNTING_PHASE2M_AUDIT = 'true'
npm run start:dev
```

In localhost Angular as admin: **Accounting → Production Readiness → Run read-only audit**, review/export findings, and cross-check Phase 2J-D and Phase 2L reconciliation before resolving any issue.

Required acceptance evidence:
- [ ] All automated tests pass on the pinned development commit.
- [ ] Real PostgreSQL read-only audit and prior Phase 2J/2L integration tests pass.
- [ ] No unexplained journal imbalance or duplicate posting remains.
- [ ] Historical invoice/AP/AR/bank balances independently reconciled.
- [ ] Manual EUR/USD valuations reviewed and signed off.
- [ ] User/role attack-path tests and production-flag denial proven.
- [ ] A staging migration and restore/rollback rehearsal completed.
- [ ] Finance, security/engineering and release owner approvals retained.

## 2M-F — Deployment and rollback preparation (no deployment)

**Release state: HOLD / NO-GO.**

The final approved rollout runbook should provide:
1. Named deployment owner, finance approver and backup/restore operator; change request and release commit SHA.
2. Immutable evidence bundle: source preflight JSON, test reports, staging schema diff, migration preview, finance reconciliations, role matrix, approved manual FX valuations, backup metadata and restore-verification logs.
3. Verified and tested production backup **before** change window; encrypted, access-restricted, with restore point and recovery time target.
4. Maintenance/read-only window and controlled application shutdown; separately reviewed additive migration execution by authorized operator.
5. Post-migration read-only row count/index/constraint checks; deploy application only after schema checks pass.
6. Start with new feature flags **disabled**; selectively enable under a controlled rollout plan only after explicit approval.
7. Reconcile journal counts, source keys, AP/AR, general ledger, bank statement totals and audit events against signed baseline.
8. If checks fail: stop writes and feature rollout; restore prior application version; evaluate forward-fix versus verified database restore with finance/DBA approval. Do not blindly reverse committed accounting entries or revert database migrations.
9. Capture final incident/change log and explicit business acceptance.

**No production execution, automatic deployment, or merge to main is part of Phase 2M implementation.**

## Known limitations and decision boundary

- Source/static scans can find known patterns but cannot certify completeness or financial correctness.
- The local historical audit only evaluates the currently connected `kora_test`; it has no authority to assert conditions in production history.
- Exported diagnostic JSON may contain financial metadata and references; store and share securely.
- The opening-balance historical transition and production-compatible bank staging migration are **deferred blockers** pending real financial and operational requirements.
- An authorized production rollout is a future, separately approved change. This package is intentionally **not** production certified.


## Phase 2M permission contract tests

`api/src/accounting/phase2m-permissions.spec.ts` verifies role metadata for the admin-only historical audit, opening balances, bank imports, match/unmatch and controlled supplier booking, and allows accountant access to read-only Phase 2J and bank history. It is a static guard-configuration test; a separate authenticated HTTP integration test is still required to verify runtime authentication and rejection behavior. The CI workflow includes this test.
