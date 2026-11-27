#!/usr/bin/env node
/**
 * Phase 2M release preflight: source-only, offline and read-only.
 * Never connects to a database, triggers migrations, or deploys.
 *
 * Run from api/: node scripts/phase2m-preflight.mjs
 * Use --strict to exit 1 while any release blocker remains.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => readFileSync(resolve(root, path), 'utf8');
const checks = [];
function check(id, ok, severity, detail) {
  checks.push({ id, passed: Boolean(ok), severity, detail });
}
function has(file, pattern) {
  if (!existsSync(resolve(root, file))) return false;
  return pattern.test(read(file));
}
const app = read('src/app.module.ts');
const migration = 'src/migrations/1764300000000-Phase2LBankReconciliation.ts';
const booking = 'src/invoices/controlled-supplier-invoice-booking.service.ts';
const pilot = 'src/accounting/phase2l-bank.service.ts';
const policy = 'src/accounting/phase2m-readiness.service.ts';

check('2M-A-audit-service', has(policy, /SET TRANSACTION READ ONLY/) &&
  has(policy, /current_database\(\)/), 'blocker',
  'Historical audit must be read-only and verify the actual connected database');
check('2M-B-legacy-review', has('src/accounting/phase2m-readiness.policy.ts',
  /LEGACY_SUPPLIER_PAYMENT_UNVERIFIED/) &&
  has('src/accounting/phase2m-readiness.policy.ts', /DUPLICATE_SOURCE_EVENT/), 'blocker',
  'Legacy payments and duplicate source-event journals require review');
check('2M-C-migration-disposition', existsSync(resolve(root, migration)) &&
  !has(migration, /db\?\.name !== 'kora_test'/), 'blocker',
  'Test-only Phase 2L migration is a no-op outside kora_test. Production requires a new approved migration and rollout plan');
check('2M-C-startup-migration-safety', !/migrationsRun:\s*true/.test(app), 'blocker',
  'API currently auto-runs migrations at boot; require a reviewed and explicitly executed production migration process');
check('2M-D-feature-flags', has(booking, /CONTROLLED_INVOICE_BOOKING/) &&
  has(pilot, /ACCOUNTING_PHASE2L/), 'blocker',
  'Controlled booking and bank reconciliation must remain gated and must be separately designed for production');
check('2M-D-admin-auth', has('src/accounting/phase2l-bank.controller.ts',
  /@Roles\('admin'\)/) &&
  has('src/accounting/phase2m-readiness.controller.ts', /@Roles\('admin'\)/), 'blocker',
  'Writes and historical audit must be admin-controlled');
check('2M-E-regression-suite', [
  'src/accounting/phase2m-readiness.policy.spec.ts',
  'src/accounting/phase2m-readiness.service.spec.ts',
  'src/accounting/phase2l-bank.integration.ts',
  'src/accounting/phase2j-report.integration.ts',
].every(p => existsSync(resolve(root, p))), 'blocker',
  'Keep reconciliation unit and database integration suites available');
check('2M-F-production-signoff', false, 'blocker',
  'Manual approval is required for backup/restore evidence, financial sign-off, release owner and rollback rehearsal; never auto-approve');

const failures = checks.filter(c => !c.passed);
const result = {
  phase: '2M', mode: 'offline-source-preflight',
  assessedAt: new Date().toISOString(),
  releaseApproved: false, // never changes through this script
  blockers: failures.length, checks,
  note: 'Source preflight alone is not a DB audit, migration dry-run, backup verification or production approval',
};
process.stdout.write(JSON.stringify(result, null, 2) + '\n');
if (process.argv.includes('--strict') && failures.some(c => c.severity === 'blocker')) {
  process.exitCode = 1;
}
