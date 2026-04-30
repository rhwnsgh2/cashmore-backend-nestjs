import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { getTestSupabaseAdminClient } from './supabase-client';
import { truncateAllTables } from './setup';
import { createTestUser } from './helpers/user.helper';
import {
  createAttendance,
  createAttendances,
} from './helpers/attendance.helper';
import { generateTestToken } from './helpers/auth.helper';

describe('Attendance API (e2e)', () => {
  let app: INestApplication;
  const supabase = getTestSupabaseAdminClient();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await truncateAllTables();
    await app.close();
  });

  beforeEach(async () => {
    await truncateAllTables();
  });

  describe('GET /attendances', () => {
    it('토큰 없이 요청하면 401을 반환한다', async () => {
      const response = await request(app.getHttpServer())
        .get('/attendances')
        .expect(401);

      expect(response.body.message).toBe('No token provided');
    });

    it('출석 기록이 없으면 빈 배열을 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const response = await request(app.getHttpServer())
        .get('/attendances')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('출석 기록을 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      await createAttendances(supabase, [
        {
          user_id: testUser.id,
          created_at_date: '2026-01-15',
          created_at: '2026-01-15T09:00:00+09:00',
        },
        {
          user_id: testUser.id,
          created_at_date: '2026-01-16',
          created_at: '2026-01-16T09:30:00+09:00',
        },
      ]);

      const response = await request(app.getHttpServer())
        .get('/attendances')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toHaveProperty('id');
      expect(response.body[0]).toHaveProperty('userId');
      expect(response.body[0]).toHaveProperty('attendanceDate');
      expect(response.body[0]).toHaveProperty('createdAt');
    });

    it('다른 사용자의 출석 기록은 포함하지 않는다', async () => {
      const testUser = await createTestUser(supabase);
      const otherUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      await createAttendances(supabase, [
        {
          user_id: testUser.id,
          created_at_date: '2026-01-15',
          created_at: '2026-01-15T09:00:00+09:00',
        },
        {
          user_id: otherUser.id,
          created_at_date: '2026-01-15',
          created_at: '2026-01-15T10:00:00+09:00',
        },
      ]);

      const response = await request(app.getHttpServer())
        .get('/attendances')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].userId).toBe(testUser.id);
    });

    it('응답에 모든 필드가 포함된다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      await createAttendance(supabase, {
        user_id: testUser.id,
        created_at_date: '2026-01-15',
        created_at: '2026-01-15T09:30:00+09:00',
      });

      const response = await request(app.getHttpServer())
        .get('/attendances')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const result = response.body[0];
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('userId', testUser.id);
      expect(result).toHaveProperty('attendanceDate', '2026-01-15');
      expect(result).toHaveProperty('createdAt');
      expect(result).not.toHaveProperty('point');
      expect(result).not.toHaveProperty('adShowPoint');
    });
  });
});
