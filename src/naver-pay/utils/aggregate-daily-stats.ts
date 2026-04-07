import type { NaverPayDailyStat } from '../interfaces/naver-pay-repository.interface';

interface AggregateInput {
  processed_at: string | null;
  cashmore_point: number;
  naverpay_point: number;
}

/**
 * 완료 건의 일자별 집계 (processed_at 기준, 최신순)
 * processed_at이 null인 row는 제외한다.
 */
export function aggregateDailyStats(
  rows: AggregateInput[],
): NaverPayDailyStat[] {
  const map = new Map<
    string,
    { count: number; cashmore_point: number; naverpay_point: number }
  >();

  for (const row of rows) {
    if (!row.processed_at) continue;
    const dateKey = row.processed_at.slice(0, 10); // YYYY-MM-DD
    const prev = map.get(dateKey) ?? {
      count: 0,
      cashmore_point: 0,
      naverpay_point: 0,
    };
    map.set(dateKey, {
      count: prev.count + 1,
      cashmore_point: prev.cashmore_point + row.cashmore_point,
      naverpay_point: prev.naverpay_point + row.naverpay_point,
    });
  }

  return Array.from(map.entries())
    .map(([date, stats]) => ({ date, ...stats }))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}
