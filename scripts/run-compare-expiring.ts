/**
 * 배치 소멸 대상 vs point/total 소멸 예정 포인트 비교 스크립트
 *
 * 배치(findExpirationTargets)가 계산한 유저별 소멸 포인트와
 * point/total API가 유저별로 보여주는 expiringPoints가 일치하는지 검증합니다.
 *
 * 사용법:
 *   npx tsx scripts/run-compare-expiring.ts [baseDate]
 *
 * 예시:
 *   npx tsx scripts/run-compare-expiring.ts 2026-02-01
 *   npx tsx scripts/run-compare-expiring.ts              # 기본값: 오늘
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

  // 배치 기준: subtract(7) — 매월 초 실행 시 전월 말 기준 6개월 초과
  const batchExpirationMonth = dayjs(baseDate)
    .tz('Asia/Seoul')
    .startOf('month')
    .subtract(7, 'month')
    .format('YYYY-MM');

  // 배치와 동일 기준으로 비교 (subtract 7)
  const apiExpirationDate = `${batchExpirationMonth}-01`;

  console.log(`\n📅 기준일: ${baseDate}`);
  console.log(
    `📦 배치/API 공통 소멸 기준월: ${batchExpirationMonth} (subtract 7)`,
  );
  console.log(`🔗 DB: ${DB_URL?.replace(/\/\/.*@/, '//***@')}\n`);

  const pool = new Pool({ connectionString: DB_URL });
  const repository = new PgPointBatchRepository(pool);

  try {
    // 1) 배치 소멸 대상 조회
    const batchTargets = await repository.findExpirationTargets(
      batchExpirationMonth,
      WITHDRAW_RULES,
    );

    console.log(`✅ 배치 소멸 대상: ${batchTargets.length}명`);

    if (batchTargets.length === 0) {
      console.log('배치 소멸 대상이 없습니다.');
      return;
    }

    // 상위 20명만 비교
    const sorted = [...batchTargets].sort(
      (a, b) => b.expiringPoints - a.expiringPoints,
    );
    const top20 = sorted.slice(0, 200);
    console.log(`🔍 상위 ${top20.length}명만 비교합니다.\n`);

    // 2) 각 대상 유저에 대해 point/total 방식으로 소멸 포인트 계산
    const mismatches: {
      userId: string;
      batch: number;
      api: number;
    }[] = [];
    const matches: string[] = [];

    for (const target of top20) {
      // monthly_earned_points에서 해당 유저의 소멸 기준월까지 적립합계
      const monthlyResult = await pool.query<{ earned_points: number }>(
        `SELECT earned_points FROM monthly_earned_points
         WHERE user_id = $1 AND year_month <= $2::date`,
        [target.userId, apiExpirationDate],
      );

      const totalEarned = monthlyResult.rows.reduce(
        (s, r) => s + Number(r.earned_points),
        0,
      );

      // 전체 출금/소멸 액션 조회
      const withdrawResult = await pool.query<{
        point_amount: number;
        status: string;
        type: string;
      }>(
        `SELECT point_amount, status, type FROM point_actions
         WHERE user_id = $1 AND type IN ('EXCHANGE_POINT_TO_CASH', 'POINT_EXPIRATION')`,
        [target.userId],
      );

      let totalWithdrawn = 0;
      for (const row of withdrawResult.rows) {
        if (
          row.type === 'EXCHANGE_POINT_TO_CASH' &&
          (row.status === 'done' || row.status === 'pending')
        ) {
          totalWithdrawn += Math.abs(Number(row.point_amount));
        } else if (row.type === 'POINT_EXPIRATION' && row.status === 'done') {
          totalWithdrawn += Math.abs(Number(row.point_amount));
        }
      }

      const apiExpiringPoints = Math.max(0, totalEarned - totalWithdrawn);

      if (target.expiringPoints !== apiExpiringPoints) {
        mismatches.push({
          userId: target.userId,
          batch: target.expiringPoints,
          api: apiExpiringPoints,
        });
      } else {
        matches.push(target.userId);
      }
    }

    // 3) 결과 출력
    console.log(`--- 비교 결과 ---`);
    console.log(`일치: ${matches.length}명`);
    console.log(`불일치: ${mismatches.length}명\n`);

    if (mismatches.length > 0) {
      console.log(`❌ 불일치 목록 (상위 20건):`);
      for (const m of mismatches.slice(0, 20)) {
        console.log(
          `  ${m.userId}  배치=${m.batch}P  API=${m.api}P  차이=${m.batch - m.api}P`,
        );
      }
      if (mismatches.length > 20) {
        console.log(`  ... 외 ${mismatches.length - 20}건`);
      }
    } else {
      console.log(
        `✅ 모든 유저의 배치 소멸 포인트와 API 소멸 포인트가 일치합니다.`,
      );
    }
  } finally {
    await pool.end();
  }
}

main().catch((err: unknown) => {
  console.error('❌ 에러:', err);
  process.exit(1);
});
