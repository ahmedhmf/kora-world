// Test-only migration bootstrap. NEVER run against a live Kora World database.
const path = require('node:path');
const { DataSource } = require('typeorm');
const dotenv = require('dotenv');

// Root .env is used by the existing data-source.ts. Environment variables override it.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const dbName = process.env.DATABASE_NAME;
const host = process.env.DATABASE_HOST || '127.0.0.1';
const port = Number(process.env.DATABASE_PORT || 5432);

if (dbName !== 'kora_test') {
  throw new Error('REFUSING migration: DATABASE_NAME must be exactly kora_test');
}
if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
  throw new Error('REFUSING migration: integration test host must be local');
}
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('Invalid test PostgreSQL port');
}
if (!process.env.DATABASE_USER || !process.env.DATABASE_PASSWORD) {
  throw new Error('DATABASE_USER and DATABASE_PASSWORD must be set for the test database');
}

const db = new DataSource({
  type: 'postgres',
  host,
  port,
  username: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: 'kora_test',
  entities: [],
  migrations: [path.resolve(__dirname, '../src/migrations/*{.ts,.js}')],
  synchronize: false,
  migrationsRun: false,
  logging: false,
});

async function run() {
  await db.initialize();
  try {
    const [identity] = await db.query(
      'SELECT current_database() AS db, inet_server_addr()::text AS server_address',
    );
    if (identity.db !== 'kora_test') throw new Error('REFUSING: connected DB is not kora_test');
    console.log('Verified test database:', identity.db);
    const applied = await db.runMigrations({ transaction: 'each' });
    console.log('Applied test migrations:', applied.map((m) => m.name).join(', ') || '(already up to date)');
  } finally {
    await db.destroy();
  }
}

run().catch((error) => {
  console.error('Test migration preparation failed:', error.message);
  process.exitCode = 1;
});
