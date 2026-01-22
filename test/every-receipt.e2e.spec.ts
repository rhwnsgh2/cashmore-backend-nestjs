import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { getTestSupabaseAdminClient } from './supabase-client';
import { truncateAllTables } from './setup';
import { createTestUser } from './helpers/user.helper';
import { createReceiptSubmissions } from './helpers/streak.helper';
import { generateTestToken } from './helpers/auth.helper';

describe('EveryReceipt API (e2e)', () => {
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

  describe('GET /every_receipt', () => {
    it('토큰 없이 요청하면 401을 반환한다', async () => {
      const response = await request(app.getHttpServer())
        .get('/every_receipt')
        .expect(401);

      expect(response.body.message).toBe('No token provided');
    });

    it('영수증이 없으면 빈 배열을 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const response = await request(app.getHttpServer())
        .get('/every_receipt')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toEqual({
        receipts: [],
      });
    });

    it('영수증 목록을 최신순으로 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      await createReceiptSubmissions(supabase, [
        {
          user_id: testUser.id,
          created_at: '2026-01-10T10:00:00+09:00',
          status: 'completed',
          point: 200,
          image_url: 'https://example.com/old.jpg',
        },
        {
          user_id: testUser.id,
          created_at: '2026-01-15T10:00:00+09:00',
          status: 'completed',
          point: 250,
          image_url: 'https://example.com/new.jpg',
        },
      ]);

      const response = await request(app.getHttpServer())
        .get('/every_receipt')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.receipts).toHaveLength(2);
      expect(response.body.receipts[0].pointAmount).toBe(250);
      expect(response.body.receipts[1].pointAmount).toBe(200);
    });

    it('모든 상태의 영수증을 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      await createReceiptSubmissions(supabase, [
        {
          user_id: testUser.id,
          created_at: '2026-01-15T10:00:00+09:00',
          status: 'completed',
          point: 250,
        },
        {
          user_id: testUser.id,
          created_at: '2026-01-15T11:00:00+09:00',
          status: 'pending',
          point: 0,
        },
        {
          user_id: testUser.id,
          created_at: '2026-01-15T12:00:00+09:00',
          status: 'rejected',
          point: 0,
        },
      ]);

      const response = await request(app.getHttpServer())
        .get('/every_receipt')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.receipts).toHaveLength(3);

      const statuses = response.body.receipts.map(
        (r: { status: string }) => r.status,
      );
      expect(statuses).toContain('completed');
      expect(statuses).toContain('pending');
      expect(statuses).toContain('rejected');
    });

    it('다른 사용자의 영수증은 포함하지 않는다', async () => {
      const testUser = await createTestUser(supabase);
      const otherUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      await createReceiptSubmissions(supabase, [
        {
          user_id: testUser.id,
          created_at: '2026-01-15T10:00:00+09:00',
          status: 'completed',
          point: 250,
        },
        {
          user_id: otherUser.id,
          created_at: '2026-01-15T10:00:00+09:00',
          status: 'completed',
          point: 300,
        },
      ]);

      const response = await request(app.getHttpServer())
        .get('/every_receipt')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.receipts).toHaveLength(1);
      expect(response.body.receipts[0].pointAmount).toBe(250);
    });

    it('영수증 필드가 올바르게 매핑된다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      await createReceiptSubmissions(supabase, [
        {
          user_id: testUser.id,
          created_at: '2026-01-15T10:30:00+09:00',
          status: 'completed',
          point: 250,
          image_url: 'https://example.com/receipt.jpg',
        },
      ]);

      const response = await request(app.getHttpServer())
        .get('/every_receipt')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const receipt = response.body.receipts[0];
      expect(receipt).toHaveProperty('id');
      expect(receipt).toHaveProperty('createdAt');
      expect(receipt.pointAmount).toBe(250);
      expect(receipt.status).toBe('completed');
      expect(receipt.imageUrl).toBe('https://example.com/receipt.jpg');
    });
  });
});
