import { Client } from 'pg';
import * as dotenv from 'dotenv';

// Load test environment
dotenv.config({ path: '.env.test' });

let client: Client | null = null;

// Per-table baseline of n_tup_ins+upd+del. A table is "dirty" when its current
// counter exceeds the baseline. TRUNCATE doesn't bump these counters, so after
// truncating we re-read and store the post-truncate values as the new baseline.
// null = no baseline yet → next call truncates everything (cold start).
let dirtyBaseline: Map<string, number> | null = null;

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

  let dirty: string[];

  if (dirtyBaseline === null) {
    // Cold start: truncate every public table to get to a known clean state.
    const all = await db.query<{ tablename: string }>(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename NOT IN ('schema_migrations', 'supabase_migrations')
    `);
    dirty = all.rows.map((r) => r.tablename);
  } else {
    await db.query('SELECT pg_stat_clear_snapshot()');
    const { rows } = await db.query<{ relname: string; total: string }>(`
      SELECT relname, (n_tup_ins + n_tup_upd + n_tup_del)::text AS total
      FROM pg_stat_user_tables
      WHERE schemaname = 'public'
    `);
    dirty = rows
      .filter((r) => Number(r.total) > (dirtyBaseline!.get(r.relname) ?? 0))
      .map((r) => r.relname);
  }

  if (dirty.length > 0) {
    await db.query(`
      TRUNCATE TABLE ${dirty.map((t) => `"${t}"`).join(', ')}
      RESTART IDENTITY CASCADE
    `);
  }

  // Refresh baseline. TRUNCATE doesn't reset n_tup_* counters, so we record
  // the post-truncate totals and treat any future increase as "dirty".
  await db.query('SELECT pg_stat_clear_snapshot()');
  const after = await db.query<{ relname: string; total: string }>(`
    SELECT relname, (n_tup_ins + n_tup_upd + n_tup_del)::text AS total
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
  `);
  dirtyBaseline = new Map(after.rows.map((r) => [r.relname, Number(r.total)]));
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

// NOTE: Global hooks removed - integration/e2e tests should call these functions explicitly
// This prevents unit tests from attempting DB connections in CI
