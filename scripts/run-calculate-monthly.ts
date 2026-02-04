/**
 * calculateMonthlyEarnedPoints CLI 스크립트
 *
 * 사용법:
 *   npx tsx scripts/run-calculate-monthly.ts [yearMonth]
 *
 * 예시:
 *   npx tsx scripts/run-calculate-monthly.ts 2026-01
 *   npx tsx scripts/run-calculate-monthly.ts          # 기본값: 지난달
 *
 * 환경변수:
 *   SUPABASE_DB_URL (기본값: postgresql://postgres:postgres@localhost:54322/postgres)
 */
import { Pool } from 'pg';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import { PgPointBatchRepository } from '../src/point-batch/repositories/pg-point-batch.repository';
import { POINT_ADD_TYPES } from '../src/point/interfaces/point-repository.interface';

dayjs.extend(utc);
dayjs.extend(timezone);

const DB_URL = process.env.SUPABASE_DB_URL;
if (!DB_URL) {
  console.error('SUPABASE_DB_URL is not set');
  process.exit(1);
}

async function main() {
  const yearMonth =
    process.argv[2] ??
    dayjs().tz('Asia/Seoul').subtract(1, 'month').format('YYYY-MM');

  console.log(`\n📅 대상 월: ${yearMonth}`);
  console.log(`🔗 DB: ${DB_URL?.replace(/\/\/.*@/, '//***@')}\n`);

  const pool = new Pool({ connectionString: DB_URL });
  const repository = new PgPointBatchRepository(pool);

  try {
    const targets = await repository.calculateMonthlyEarnedPoints(
      yearMonth,
      POINT_ADD_TYPES,
    );

    console.log(`✅ 집계 결과: ${targets.length}명\n`);

    if (targets.length === 0) {
      console.log('집계 대상이 없습니다.');
    } else {
      const totalPoints = targets.reduce((s, t) => s + t.earnedPoints, 0);
      console.log(`총 적립 포인트: ${totalPoints.toLocaleString()}P`);
    }

    // monthly_earned_points 테이블과 비교
    console.log(`\n--- monthly_earned_points 테이블 비교 ---`);
    const stored = await pool.query<{
      user_id: string;
      earned_points: number;
    }>(
      `SELECT user_id, earned_points FROM monthly_earned_points WHERE year_month = $1::date`,
      [`${yearMonth}-01`],
    );

    const storedMap = new Map(
      stored.rows.map((r) => [r.user_id, Number(r.earned_points)]),
    );
    const calcMap = new Map<string, number>(
      targets.map((t) => [t.userId, t.earnedPoints]),
    );

    // 불일치 찾기
    const mismatches: {
      userId: string;
      calculated: number;
      stored: number;
    }[] = [];
    const onlyInCalc: { userId: string; points: number }[] = [];
    const onlyInStored: { userId: string; points: number }[] = [];

    for (const [userId, calcPoints] of calcMap) {
      const storedPoints = storedMap.get(userId);
      if (storedPoints === undefined) {
        onlyInCalc.push({ userId, points: calcPoints });
      } else if (calcPoints !== storedPoints) {
        mismatches.push({
          userId,
          calculated: calcPoints,
          stored: storedPoints,
        });
      }
    }
    for (const [userId, storedPoints] of storedMap) {
      if (!calcMap.has(userId)) {
        onlyInStored.push({ userId, points: storedPoints });
      }
    }

    console.log(`테이블 레코드: ${stored.rows.length}건`);
    console.log(`계산 결과: ${targets.length}건`);

    if (
      mismatches.length === 0 &&
      onlyInCalc.length === 0 &&
      onlyInStored.length === 0
    ) {
      console.log(`\n✅ 완전 일치`);
    } else {
      if (mismatches.length > 0) {
        console.log(`\n❌ 값 불일치: ${mismatches.length}건`);
        for (const m of mismatches.slice(0, 10)) {
          console.log(`  ${m.userId}  계산=${m.calculated}  저장=${m.stored}`);
        }
      }
      if (onlyInCalc.length > 0) {
        console.log(`\n⚠️  계산에만 존재: ${onlyInCalc.length}건`);
        for (const o of onlyInCalc.slice(0, 10)) {
          console.log(`  ${o.userId}  ${o.points}P`);
        }
      }
      if (onlyInStored.length > 0) {
        console.log(`\n⚠️  테이블에만 존재: ${onlyInStored.length}건`);
        for (const o of onlyInStored.slice(0, 10)) {
          console.log(`  ${o.userId}  ${o.points}P`);
        }
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
