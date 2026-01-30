import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import type {
  IPointBatchRepository,
  MonthlyEarnedPoint,
  ExpirationTarget,
  WithdrawRule,
} from '../interfaces/point-batch-repository.interface';

export const PG_POOL = Symbol('PG_POOL');

@Injectable()
export class PgPointBatchRepository implements IPointBatchRepository {
  constructor(
    @Inject(PG_POOL)
    private pool: Pool,
  ) {}

  async calculateMonthlyEarnedPoints(
    yearMonth: string,
    earnTypes: readonly string[],
  ): Promise<MonthlyEarnedPoint[]> {
    const startDate = `${yearMonth}-01`;

    const result = await this.pool.query<{
      user_id: string;
      earned_points: number;
    }>(
      `
      SELECT
        user_id,
        COALESCE(SUM(point_amount), 0) AS earned_points
      FROM point_actions
      WHERE type = ANY($1)
        AND status = 'done'
        AND created_at >= ($2::date::timestamp AT TIME ZONE 'Asia/Seoul')
        AND created_at < (($2::date + INTERVAL '1 month')::timestamp AT TIME ZONE 'Asia/Seoul')
      GROUP BY user_id
      `,
      [[...earnTypes], startDate],
    );

    return result.rows.map((row) => ({
      userId: row.user_id,
      earnedPoints: Number(row.earned_points),
    }));
  }

  async upsertMonthlyEarnedPoints(
    yearMonth: string,
    targets: MonthlyEarnedPoint[],
  ): Promise<number> {
    if (targets.length === 0) return 0;

    const startDate = `${yearMonth}-01`;
    const CHUNK_SIZE = 1000;
    let totalUpserted = 0;

    for (let i = 0; i < targets.length; i += CHUNK_SIZE) {
      const chunk = targets.slice(i, i + CHUNK_SIZE);

      const values: string[] = [];
      const params: (string | number)[] = [startDate];
      let paramIndex = 2;

      for (let j = 0; j < chunk.length; j++) {
        const target = chunk[j];
        values.push(`($${paramIndex}, $1::date, $${paramIndex + 1})`);
        params.push(target.userId, target.earnedPoints);
        paramIndex += 2;
      }

      const result = await this.pool.query(
        `
        INSERT INTO monthly_earned_points (user_id, year_month, earned_points)
        VALUES ${values.join(', ')}
        ON CONFLICT (user_id, year_month)
        DO UPDATE SET earned_points = EXCLUDED.earned_points
        `,
        params,
      );

      totalUpserted += result.rowCount ?? 0;
    }

    return totalUpserted;
  }

  async findExpirationTargets(
    expirationMonth: string,
    withdrawRules: readonly WithdrawRule[],
  ): Promise<ExpirationTarget[]> {
    const expirationDate = `${expirationMonth}-01`;

    // withdrawRules로부터 동적 WHERE 절 생성
    const conditions: string[] = [];
    const params: (string | string[])[] = [expirationDate];
    let paramIndex = 2;

    for (let i = 0; i < withdrawRules.length; i++) {
      const rule = withdrawRules[i];
      conditions.push(
        `(type = $${paramIndex} AND status = ANY($${paramIndex + 1}))`,
      );
      params.push(rule.type, [...rule.statuses]);
      paramIndex += 2;
    }

    const withdrawWhere =
      conditions.length > 0 ? conditions.join(' OR ') : 'FALSE';

    const result = await this.pool.query<{
      user_id: string;
      expiring_points: number;
    }>(
      `
      WITH earned AS (
        SELECT user_id, COALESCE(SUM(earned_points), 0) AS total_earned
        FROM monthly_earned_points
        WHERE year_month <= $1::date
        GROUP BY user_id
      ),
      withdrawn AS (
        SELECT user_id, COALESCE(SUM(ABS(point_amount)), 0) AS total_withdrawn
        FROM point_actions
        WHERE (${withdrawWhere})
        GROUP BY user_id
      )
      SELECT
        e.user_id,
        GREATEST(0, e.total_earned - COALESCE(w.total_withdrawn, 0)) AS expiring_points
      FROM earned e
      LEFT JOIN withdrawn w ON e.user_id = w.user_id
      WHERE e.total_earned - COALESCE(w.total_withdrawn, 0) > 0
      `,
      params,
    );

    return result.rows.map((row) => ({
      userId: row.user_id,
      expiringPoints: Number(row.expiring_points),
    }));
  }

  async insertExpirationActions(
    targets: ExpirationTarget[],
    baseDate: string,
    expirationMonth: string,
  ): Promise<number> {
    if (targets.length === 0) return 0;

    const CHUNK_SIZE = 1000;
    let totalInserted = 0;

    for (let i = 0; i < targets.length; i += CHUNK_SIZE) {
      const chunk = targets.slice(i, i + CHUNK_SIZE);

      const values: string[] = [];
      const params: (string | number)[] = [];
      let paramIndex = 1;

      for (const target of chunk) {
        values.push(
          `($${paramIndex}, 'POINT_EXPIRATION', $${paramIndex + 1}, 'done', NOW(), $${paramIndex + 2}::jsonb)`,
        );
        params.push(
          target.userId,
          -target.expiringPoints,
          JSON.stringify({
            base_date: baseDate,
            expiration_month: expirationMonth,
          }),
        );
        paramIndex += 3;
      }

      const result = await this.pool.query(
        `
        INSERT INTO point_actions (user_id, type, point_amount, status, created_at, additional_data)
        VALUES ${values.join(', ')}
        `,
        params,
      );

      totalInserted += result.rowCount ?? 0;
    }

    return totalInserted;
  }

  async deleteExpirationActions(expirationMonth: string): Promise<number> {
    const result = await this.pool.query(
      `
      DELETE FROM point_actions
      WHERE type = 'POINT_EXPIRATION'
        AND status = 'done'
        AND additional_data->>'expiration_month' = $1
      `,
      [expirationMonth],
    );

    return result.rowCount ?? 0;
  }
}
