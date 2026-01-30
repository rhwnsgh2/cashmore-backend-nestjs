/**
 * findExpirationTargets CLI 스크립트 (소멸 대상 미리보기)
 *
 * 사용법:
 *   npx tsx scripts/run-expire-preview.ts [baseDate]
 *
 * 예시:
 *   npx tsx scripts/run-expire-preview.ts 2026-02-01
 *   npx tsx scripts/run-expire-preview.ts              # 기본값: 오늘
 */
import { Pool } from 'pg';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import { PgPointBatchRepository } from '../src/point-batch/repositories/pg-point-batch.repository';
import { WITHDRAW_RULES } from '../src/point-batch/point-batch.service';

dayjs.extend(utc);
dayjs.extend(timezone);

const DB_URL = process.env.SUPABASE_DB_URL;
if (!DB_URL) {
  console.error('SUPABASE_DB_URL is not set');
  process.exit(1);
}

async function main() {
  const baseDate =
    process.argv[2] ?? dayjs().tz('Asia/Seoul').format('YYYY-MM-DD');
  const expirationMonth = dayjs(baseDate)
    .tz('Asia/Seoul')
    .startOf('month')
    .subtract(7, 'month')
    .format('YYYY-MM');

  console.log(`\n📅 기준일: ${baseDate}`);
  console.log(
    `📅 소멸 기준월: ${expirationMonth} (7개월 전, 6개월 초과분 소멸)`,
  );
  console.log(`🔗 DB: ${DB_URL?.replace(/\/\/.*@/, '//***@')}\n`);

  const pool = new Pool({ connectionString: DB_URL });
  const repository = new PgPointBatchRepository(pool);

  try {
    const targets = await repository.findExpirationTargets(
      expirationMonth,
      WITHDRAW_RULES,
    );

    console.log(`✅ 소멸 대상: ${targets.length}명`);

    if (targets.length === 0) {
      console.log('소멸 대상이 없습니다.');
    } else {
      const totalPoints = targets.reduce((s, t) => s + t.expiringPoints, 0);
      console.log(`총 소멸 예정 포인트: ${totalPoints.toLocaleString()}P\n`);

      const sorted = [...targets].sort(
        (a, b) => b.expiringPoints - a.expiringPoints,
      );
      const top = sorted.slice(0, 20);

      console.log(`--- 상위 ${top.length}명 ---`);
      for (const t of top) {
        console.log(`  ${t.userId}  ${t.expiringPoints.toLocaleString()}P`);
      }
      if (sorted.length > 20) {
        console.log(`  ... 외 ${sorted.length - 20}명`);
      }
    }
  } finally {
    await pool.end();
  }
}

main().catch((err: unknown) => {
  console.error('❌ 에러:', err);
  process.exit(1);
});
