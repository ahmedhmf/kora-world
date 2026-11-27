# PostgreSQL Accounting Posting Integration Tests

Target branch: `feature/accounting-redesign`.

## Safety boundaries
- Only execute on a local PostgreSQL host (`localhost`, `127.0.0.1`, or `::1`) and database **exactly** named `kora_test`.
- Scripts verify the connected database name, not just the environment variable.
- Never run these commands with `kora_world` or a production host. No database reset is included.
- The preparation script runs **existing repository migrations in kora_test only**. These migrations create other application tables too; only run in the disposable test database.
- The integration tests add two temporary EGP accounts, write journals inside kora_test, then delete their own rows.
- There is no operational impact on `kora_world`. The new posting service is not yet connected to old invoices or payments.

## Windows PowerShell — one-time preparation

From `D:\Ahmed\project\kora-world\api`:

```powershell
git switch feature/accounting-redesign
git pull --ff-only origin feature/accounting-redesign

# Override the normal application's database in THIS PowerShell session.
$env:DATABASE_NAME = 'kora_test'
$env:DATABASE_HOST = '127.0.0.1'

# Use your existing local DATABASE_USER, DATABASE_PASSWORD, and DATABASE_PORT settings.
# The scripts also read .env from the repository root and api directory, without overriding shell variables.

# Validate the test DB exists; this is read-only:
docker exec kora_world_db psql -U kora_admin -d kora_test -c "SELECT current_database();"

# Run migrations only in kora_test (will refuse other database names and remote hosts):
node -r ts-node/register scripts/prepare-accounting-test-db.js
```

**Note:** If your local PostgreSQL container is not exposed on port 5432, set `$env:DATABASE_PORT` to the host port published by Docker. Do not set the host to the Docker container name: this runner intentionally allows local hosts only. Ensure your local `.env` supplies `DATABASE_USER` and `DATABASE_PASSWORD`, or set them in the PowerShell session without committing secrets.

## Run tests

```powershell
npm run build
npm test -- --runInBand accounting-posting.service.spec.ts
npm run test:accounting:integration
```

Integration coverage:
1. Real balanced journal persisted with two lines and correct base balance.
2. Same unique source event cannot create a second journal entry.
3. An exception *after the database inserts within the enclosing transaction* rolls back the inserted journal.

These tests run separately from ordinary `npm test` (which does not discover `*.integration.ts` files).

## Troubleshooting
- **Database not `kora_test`**: the script intentionally refuses to run.
- **Missing accounting tables/unique index**: prepare migrations on `kora_test` first.
- **Connection refused**: inspect `docker compose ps` and published PostgreSQL port.
- **Password error**: verify credentials from your existing local environment settings without pasting passwords in chat.
- **Unexpected migration failure**: stop and share the error output; do not point the command at `kora_world`.

## What these tests do not prove
This milestone tests the new isolated EGP posting service, not invoice/payment integration, FX posting, approval/period locking, reconciliation, or migrations in a production environment. Those require later milestones and their own tests.
