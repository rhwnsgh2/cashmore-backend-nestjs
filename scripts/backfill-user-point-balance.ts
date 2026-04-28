/**
 * user_point_balance 백필 스크립트 (일회성)
 *
 * user 테이블의 모든 user_id를 페이지네이션으로 순회하면서
 * 각 유저의 SUM(point_actions.point_amount)을 계산해 user_point_balance에 UPSERT.
 *
 * 멱등성: WHERE total_point IS DISTINCT FROM 가드로 값 같으면 NO-OP.
 * 안전성: 트리거/Phase2 syncBalance와 race가 나도 다음 호출에서 자가 수렴.
 * 재개 가능: 마지막 처리 user_id 기록 가능, --resume-from 옵션으로 이어서.
 *
 * 사용법:
 *   SUPABASE_DB_URL=... npx tsx scripts/backfill-user-point-balance.ts [--dry-run] [--sleep-ms=50] [--sample=1000] [--resume-from=<uuid>]
 *
 * 추천 흐름:
 *   1. --sample=1000 --dry-run로 부하/소요 시간 추정
 *   2. --sample=1000 (실제 1000명만 백필, 영향 작게 검증)
 *   3. --sleep-ms=200으로 전체 백필, 운영 메트릭 보면서 줄이기
 */
import { Pool } from 'pg';

const DB_URL = process.env.SUPABASE_DB_URL;
const DRY_RUN = process.argv.includes('--dry-run');
const SLEEP_MS = parseIntArg('--sleep-ms', 50);
const RESUME_FROM = parseStringArg('--resume-from', '00000000-0000-0000-0000-000000000000');
const STOP_AT = parseStringArg('--stop-at', 'ffffffff-ffff-ffff-ffff-ffffffffffff');
const SAMPLE_SIZE = parseIntArg('--sample', 0); // 0 = 전체
const PAGE_SIZE = 1000;
const PROGRESS_EVERY = 500;

if (!DB_URL) {
  console.error('SUPABASE_DB_URL is not set');
  process.exit(1);
}

interface UserRow {
  id: string;
}

interface BackfillResult {
  scanned: number;
  written: number;
  skipped_unchanged: number;
  errors: number;
}

function parseIntArg(name: string, fallback: number): number {
  const arg = process.argv.find((a) => a.startsWith(`${name}=`));
  if (!arg) return fallback;
  const value = Number(arg.split('=')[1]);
  if (!Number.isFinite(value) || value < 0) return fallback;
  return value;
}

function parseStringArg(name: string, fallback: string): string {
  const arg = process.argv.find((a) => a.startsWith(`${name}=`));
  if (!arg) return fallback;
  return arg.split('=')[1] ?? fallback;
}

async function sleep(ms: number): Promise<void> {
  if (ms <= 0) return;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchUserBatch(pool: Pool, afterId: string): Promise<UserRow[]> {
  const { rows } = await pool.query<UserRow>(
    `SELECT id FROM "user" WHERE id > $1 AND id <= $2 ORDER BY id LIMIT $3`,
    [afterId, STOP_AT, PAGE_SIZE],
  );
  return rows;
}

async function fetchSampleUsers(pool: Pool, n: number): Promise<UserRow[]> {
  const { rows } = await pool.query<UserRow>(
    `SELECT id FROM "user" ORDER BY random() LIMIT $1`,
    [n],
  );
  return rows;
}

async function backfillUser(
  pool: Pool,
  userId: string,
): Promise<'written' | 'skipped' | 'error'> {
  if (DRY_RUN) {
    // dry-run에선 SUM 계산만 하고 비교
    const { rows } = await pool.query<{ sum: string; cached: string | null }>(
      `
      SELECT
        (SELECT COALESCE(SUM(point_amount), 0) FROM point_actions WHERE user_id = $1) AS sum,
        (SELECT total_point FROM user_point_balance WHERE user_id = $1) AS cached
      `,
      [userId],
    );
    const computed = Number(rows[0]?.sum ?? 0);
    const cached = rows[0]?.cached === null ? null : Number(rows[0]?.cached);
    return cached === computed ? 'skipped' : 'written';
  }

  try {
    const { rowCount } = await pool.query(
      `
      INSERT INTO user_point_balance (user_id, total_point, updated_at)
      SELECT $1, COALESCE(SUM(point_amount), 0)::bigint, now()
      FROM point_actions WHERE user_id = $1
      ON CONFLICT (user_id) DO UPDATE
        SET total_point = EXCLUDED.total_point,
            updated_at  = now()
        WHERE user_point_balance.total_point IS DISTINCT FROM EXCLUDED.total_point
      `,
      [userId],
    );
    return rowCount && rowCount > 0 ? 'written' : 'skipped';
  } catch (err) {
    console.error(`error user_id=${userId}:`, err);
    return 'error';
  }
}

async function* iterateUsers(pool: Pool): AsyncGenerator<UserRow> {
  if (SAMPLE_SIZE > 0) {
    const sample = await fetchSampleUsers(pool, SAMPLE_SIZE);
    for (const u of sample) yield u;
    return;
  }

  let lastId = RESUME_FROM;
  for (;;) {
    const users = await fetchUserBatch(pool, lastId);
    if (users.length === 0) break;
    for (const u of users) yield u;
    lastId = users[users.length - 1].id;
  }
}

async function main(): Promise<void> {
  console.log(`\nMode:        ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}`);
  console.log(`DB:          ${DB_URL?.replace(/\/\/.*@/, '//***@')}`);
  console.log(`Sleep:       ${SLEEP_MS} ms/user`);
  if (SAMPLE_SIZE > 0) {
    console.log(`Sample:      ${SAMPLE_SIZE} (random)`);
  } else {
    console.log(`Resume from: ${RESUME_FROM}`);
    console.log(`Stop at:     ${STOP_AT}`);
  }
  console.log('');

  const pool = new Pool({ connectionString: DB_URL });
  const result: BackfillResult = {
    scanned: 0,
    written: 0,
    skipped_unchanged: 0,
    errors: 0,
  };
  const startMs = Date.now();

  try {
    for await (const u of iterateUsers(pool)) {
      const status = await backfillUser(pool, u.id);
      result.scanned += 1;
      if (status === 'written') result.written += 1;
      else if (status === 'skipped') result.skipped_unchanged += 1;
      else result.errors += 1;

      if (result.scanned % PROGRESS_EVERY === 0) {
        console.log(
          `  scanned=${result.scanned} written=${result.written} skipped=${result.skipped_unchanged} errors=${result.errors} (last=${u.id})`,
        );
      }

      await sleep(SLEEP_MS);
    }

    const elapsedMs = Date.now() - startMs;
    const avgMs = result.scanned > 0 ? elapsedMs / result.scanned : 0;
    console.log(`\nDone.`);
    console.log(`  scanned: ${result.scanned}`);
    console.log(`  written: ${result.written}`);
    console.log(`  skipped: ${result.skipped_unchanged}`);
    console.log(`  errors:  ${result.errors}`);
    console.log(`  elapsed: ${(elapsedMs / 1000).toFixed(1)}s (avg ${avgMs.toFixed(1)}ms/user)`);
    if (SAMPLE_SIZE > 0) {
      const totalEstimate = (avgMs * 242565) / 1000 / 60;
      console.log(`  → 전체 24만 유저 추정 소요: ${totalEstimate.toFixed(1)}분`);
    }
    if (DRY_RUN) {
      console.log(`(dry-run: nothing was written)`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err: unknown) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
