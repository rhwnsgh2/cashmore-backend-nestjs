import { beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import * as dotenv from 'dotenv';

// Load test environment
dotenv.config({ path: '.env.test' });

let client: Client | null = null;

export async function getTestDbClient(): Promise<Client> {
  if (!client) {
    client = new Client({
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '54332'),
      user: process.env.DATABASE_USER || 'postgres',
      password: process.env.DATABASE_PASSWORD || 'postgres',
      database: process.env.DATABASE_NAME || 'postgres',
    });

    await client.connect();
  }
  return client;
}

export async function closeTestDbClient(): Promise<void> {
  if (client) {
    await client.end();
    client = null;
  }
}

export async function truncateAllTables(): Promise<void> {
  const db = await getTestDbClient();

  // Get all tables in public schema (excluding system tables)
  const result = await db.query(`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename NOT IN ('schema_migrations', 'supabase_migrations')
  `);

  const tables = result.rows.map((r) => r.tablename);

  if (tables.length > 0) {
    // TRUNCATE with CASCADE to handle foreign key constraints
    // RESTART IDENTITY to reset auto-increment counters
    await db.query(`
      TRUNCATE TABLE ${tables.map((t) => `"${t}"`).join(', ')}
      RESTART IDENTITY CASCADE
    `);
  }
}

export async function truncateTables(...tableNames: string[]): Promise<void> {
  if (tableNames.length === 0) return;

  const db = await getTestDbClient();
  await db.query(`
    TRUNCATE TABLE ${tableNames.map((t) => `"${t}"`).join(', ')}
    RESTART IDENTITY CASCADE
  `);
}

// Clean auth.users if needed
export async function cleanAuthUsers(): Promise<void> {
  const db = await getTestDbClient();
  await db.query('DELETE FROM auth.users');
}

// Disable all Slack notification triggers (prevent Slack spam during tests)
export async function disableSlackTriggers(): Promise<void> {
  const db = await getTestDbClient();

  // Disable Slack triggers on public schema tables
  const triggers = [
    { table: 'user', trigger: 'on_added_user' },
    { table: 'user', trigger: 'on_delete_user' },
    { table: 'account_info', trigger: 'on_added_account_info' },
    { table: 'claim', trigger: 'on_complete_claim' },
    { table: 'claim', trigger: 'on_insert_claim' },
    { table: 'claim', trigger: 'on_rejected_claim' },
    { table: 'claim', trigger: 'on_update_claim' },
    { table: 'partner_user', trigger: 'on_insert_partner_user' },
  ];

  for (const { table, trigger } of triggers) {
    try {
      await db.query(
        `ALTER TABLE "public"."${table}" DISABLE TRIGGER "${trigger}"`,
      );
    } catch {
      // Trigger might not exist, ignore
    }
  }
}

// Global hooks (skip in CI without DB)
if (process.env.SKIP_DB_TESTS !== 'true') {
  beforeAll(async () => {
    await disableSlackTriggers();
    await truncateAllTables();
  });

  afterAll(async () => {
    await closeTestDbClient();
  });
}
