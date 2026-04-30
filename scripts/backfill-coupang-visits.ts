/**
 * coupang_visits 백필 스크립트 (일회성)
 *
 * point_actions WHERE type='COUPANG_VISIT'을 coupang_visits 테이블로 복사한다.
 * 같은 (user_id, KST 날짜) 중복은 첫 행만 살린다 (DISTINCT ON + 정렬).
 *
 * 멱등성: ON CONFLICT (user_id, created_at_date) DO NOTHING.
 *   → dual-write로 이미 들어간 행, 이전 backfill로 들어간 행 모두 안전 스킵.
 *   → 컷오프 없이 전체 기간 돌려도 OK.
 *
 * 청크: created_at 범위 (기본 7일씩). point_actions_created_at_idx 활용.
 *
 * 사용법:
 *   SUPABASE_DB_URL=... npx tsx scripts/backfill-coupang-visits.ts \
 *     [--dry-run] [--sleep-ms=500] [--chunk-days=7] \
 *     [--start=2024-01-01] [--end=2026-04-30]
 *
 * 추천 흐름:
 *   1. --dry-run으로 청크별 행 수 추정
 *   2. --start=<최근 1주> --sleep-ms=1000 으로 작게 검증
 *   3. 전체 기간 --sleep-ms=500
 */
import { Pool } from 'pg';

const DB_URL = process.env.SUPABASE_DB_URL;
const DRY_RUN = process.argv.includes('--dry-run');
const SLEEP_MS = parseIntArg('--sleep-ms', 500);
const CHUNK_DAYS = parseIntArg('--chunk-days', 7);
const START_DATE = parseStringArg('--start', '2024-01-01');
const END_DATE = parseStringArg('--end', new Date().toISOString().slice(0, 10));

if (!DB_URL) {
  console.error('SUPABASE_DB_URL is not set');
  process.exit(1);
}

interface ChunkResult {
  chunkStart: string;
  chunkEnd: string;
  scannedSource: number;
  inserted: number;
  skippedConflict: number;
  errors: number;
  elapsedMs: number;
}

interface TotalResult {
  chunks: number;
  scannedSource: number;
  inserted: number;
  skippedConflict: number;
  errors: number;
}

function parseIntArg(name: string, fallback: number): number {
  const arg = process.argv.find((a) => a.startsWith(`${name}=`));
  if (!arg) return fallback;
  const value = Number(arg.split('=')[1]);
  if (!Number.isFinite(value) || value <= 0) return fallback;
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

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function processChunk(
  pool: Pool,
  chunkStart: string,
  chunkEnd: string,
): Promise<ChunkResult> {
  const startMs = Date.now();
  const result: ChunkResult = {
    chunkStart,
    chunkEnd,
    scannedSource: 0,
    inserted: 0,
    skippedConflict: 0,
    errors: 0,
    elapsedMs: 0,
  };

  try {
    // 1. 청크 내 source 행 수 (참고용)
    const { rows: sourceRows } = await pool.query<{ cnt: string }>(
      `
      SELECT COUNT(*)::text AS cnt
      FROM point_actions
      WHERE type = 'COUPANG_VISIT'
        AND created_at >= $1::timestamptz
        AND created_at <  $2::timestamptz
      `,
      [chunkStart, chunkEnd],
    );
    result.scannedSource = Number(sourceRows[0]?.cnt ?? 0);

    if (result.scannedSource === 0) {
      result.elapsedMs = Date.now() - startMs;
      return result;
    }

    if (DRY_RUN) {
      // dry-run: distinct (user_id, KST date) 추정만 계산
      const { rows: distinctRows } = await pool.query<{ cnt: string }>(
        `
        SELECT COUNT(DISTINCT (user_id, to_char(created_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD')))::text AS cnt
        FROM point_actions
        WHERE type = 'COUPANG_VISIT'
          AND created_at >= $1::timestamptz
          AND created_at <  $2::timestamptz
        `,
        [chunkStart, chunkEnd],
      );
      result.inserted = Number(distinctRows[0]?.cnt ?? 0);
      result.skippedConflict = result.scannedSource - result.inserted;
      result.elapsedMs = Date.now() - startMs;
      return result;
    }

    // 2. 실제 INSERT (DISTINCT ON으로 user×date 중복 1건만)
    const { rowCount } = await pool.query(
      `
      INSERT INTO coupang_visits (user_id, created_at_date, point_amount, created_at)
      SELECT DISTINCT ON (user_id, to_char(created_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD'))
        user_id,
        to_char(created_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD') AS created_at_date,
        point_amount::int,
        created_at
      FROM point_actions
      WHERE type = 'COUPANG_VISIT'
        AND created_at >= $1::timestamptz
        AND created_at <  $2::timestamptz
      ORDER BY
        user_id,
        to_char(created_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD'),
        created_at ASC
      ON CONFLICT (user_id, created_at_date) DO NOTHING
      `,
      [chunkStart, chunkEnd],
    );
    result.inserted = rowCount ?? 0;
    result.skippedConflict = result.scannedSource - result.inserted;
  } catch (err) {
    console.error(`error chunk ${chunkStart}~${chunkEnd}:`, err);
    result.errors += 1;
  }

  result.elapsedMs = Date.now() - startMs;
  return result;
}

async function main(): Promise<void> {
  console.log(`\nMode:        ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}`);
  console.log(`DB:          ${DB_URL?.replace(/\/\/.*@/, '//***@')}`);
  console.log(`Range:       ${START_DATE} ~ ${END_DATE}`);
  console.log(`Chunk:       ${CHUNK_DAYS} days`);
  console.log(`Sleep:       ${SLEEP_MS} ms / chunk`);
  console.log('');

  const pool = new Pool({ connectionString: DB_URL });
  const total: TotalResult = {
    chunks: 0,
    scannedSource: 0,
    inserted: 0,
    skippedConflict: 0,
    errors: 0,
  };
  const startMs = Date.now();

  try {
    let cursor = START_DATE;
    while (cursor < END_DATE) {
      const next = addDays(cursor, CHUNK_DAYS);
      const chunkEnd = next > END_DATE ? END_DATE : next;

      const r = await processChunk(pool, cursor, chunkEnd);
      total.chunks += 1;
      total.scannedSource += r.scannedSource;
      total.inserted += r.inserted;
      total.skippedConflict += r.skippedConflict;
      total.errors += r.errors;

      console.log(
        `  [${r.chunkStart} ~ ${r.chunkEnd})  source=${r.scannedSource}  inserted=${r.inserted}  skipped=${r.skippedConflict}  ${(r.elapsedMs / 1000).toFixed(1)}s`,
      );

      cursor = chunkEnd;
      await sleep(SLEEP_MS);
    }

    const elapsedMs = Date.now() - startMs;
    console.log(`\nDone.`);
    console.log(`  chunks:           ${total.chunks}`);
    console.log(`  scanned (source): ${total.scannedSource}`);
    console.log(`  inserted:         ${total.inserted}`);
    console.log(`  skipped:          ${total.skippedConflict}`);
    console.log(`  errors:           ${total.errors}`);
    console.log(`  elapsed:          ${(elapsedMs / 1000).toFixed(1)}s`);
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
