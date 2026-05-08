import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { getTestSupabaseAdminClient } from './supabase-client';
import { truncateAllTables } from './setup';
import { createTestUser, TestUser } from './helpers/user.helper';
import { generateTestToken } from './helpers/auth.helper';
import { createPointAction } from './helpers/point.helper';
import { createAttendance } from './helpers/attendance.helper';
import {
  createEveryReceipt,
  createStepReward,
  createAffiliateData,
  createLocationInfo,
  createClaim,
} from './helpers/cashback.helper';

describe('Cashback API (e2e) - Real DB', () => {
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

  describe('GET /cashback/list', () => {
    describe('인증', () => {
      it('토큰 없이 요청하면 401을 반환한다', async () => {
        const response = await request(app.getHttpServer())
          .get('/cashback/list')
          .expect(401);

        expect(response.body.message).toBe('No token provided');
      });
    });

    describe('캐시백 리스트 조회', () => {
      let testUser: TestUser;
      let token: string;

      beforeEach(async () => {
        testUser = await createTestUser(supabase);
        token = generateTestToken(testUser.auth_id);
      });

      it('데이터가 없으면 빈 배열과 null 커서를 반환한다', async () => {
        const response = await request(app.getHttpServer())
          .get('/cashback/list')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body.items).toEqual([]);
        expect(response.body.nextCursor).toBeNull();
      });

      it('everyReceipt 데이터를 반환한다', async () => {
        await createEveryReceipt(supabase, {
          user_id: testUser.id,
          point: 100,
          status: 'done',
          image_url: 'https://example.com/img.jpg',
        });

        const response = await request(app.getHttpServer())
          .get('/cashback/list')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body.items).toHaveLength(1);
        expect(response.body.items[0].type).toBe('everyReceipt');
        expect(response.body.items[0].amount).toBe(100);
        expect(response.body.items[0].data.imageUrl).toBe(
          'https://example.com/img.jpg',
        );
      });

      it('pointActions 데이터를 타입 매핑하여 반환한다', async () => {
        await createPointAction(supabase, {
          user_id: testUser.id,
          type: 'LOTTERY' as any,
          point_amount: 500,
          status: 'done',
        });

        const response = await request(app.getHttpServer())
          .get('/cashback/list')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body.items).toHaveLength(1);
        expect(response.body.items[0].type).toBe('lottery');
        expect(response.body.items[0].amount).toBe(500);
      });

      it('stepRewards 데이터를 반환한다', async () => {
        await createStepReward(supabase, {
          user_id: testUser.id,
          step_count: 5000,
          point_amount: 30,
          rewarded_date: '2026-03-24',
        });

        const response = await request(app.getHttpServer())
          .get('/cashback/list')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body.items).toHaveLength(1);
        expect(response.body.items[0].type).toBe('stepReward');
        expect(response.body.items[0].amount).toBe(30);
        expect(response.body.items[0].data.stepCount).toBe(5000);
      });

      it('affiliate 데이터를 반환한다', async () => {
        await createAffiliateData(supabase, {
          user_id: testUser.id,
          transaction_id: 12345,
          point_amount: 500,
          approval_date: '2026-03-24T10:00:00Z',
          status: 'completed',
          data: { merchant_id: 'shop1', product_name: 'Test Product' },
        });

        const response = await request(app.getHttpServer())
          .get('/cashback/list')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body.items).toHaveLength(1);
        expect(response.body.items[0].type).toBe('affiliateCashback');
        expect(response.body.items[0].amount).toBe(500);
        expect(response.body.items[0].data.merchantId).toBe('shop1');
      });

      it('attendance + pointAction 매칭하여 반환한다', async () => {
        const att = await createAttendance(supabase, {
          user_id: testUser.id,
          created_at_date: '2026-03-24',
        });

        await createPointAction(supabase, {
          user_id: testUser.id,
          type: 'ATTENDANCE' as any,
          point_amount: 10,
          status: 'done',
          additional_data: { attendance_id: att.id },
        });

        const response = await request(app.getHttpServer())
          .get('/cashback/list')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        const attendanceItem = response.body.items.find(
          (i: any) => i.type === 'attendance',
        );
        expect(attendanceItem).toBeDefined();
        expect(attendanceItem.amount).toBe(10);
        expect(attendanceItem.data.attendanceDate).toBe('2026-03-24');
      });

      it('claim + location_info 조인하여 반환한다', async () => {
        const location = await createLocationInfo(supabase, {
          title: 'Test Cafe',
        });

        await createClaim(supabase, {
          user_id: testUser.id,
          location_id: location.id,
          cashback_amount: 200,
          status: 'completed',
        });

        const response = await request(app.getHttpServer())
          .get('/cashback/list')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body.items).toHaveLength(1);
        expect(response.body.items[0].type).toBe('claim');
        expect(response.body.items[0].amount).toBe(200);
        expect(response.body.items[0].data.title).toBe('Test Cafe');
      });

      it('여러 테이블 데이터를 created_at 내림차순으로 정렬한다', async () => {
        await createEveryReceipt(supabase, {
          user_id: testUser.id,
          point: 100,
          created_at: '2026-03-24T12:00:00Z',
        });

        await createStepReward(supabase, {
          user_id: testUser.id,
          step_count: 3000,
          point_amount: 30,
          rewarded_date: '2026-03-24',
          created_at: '2026-03-24T10:00:00Z',
        });

        await createPointAction(supabase, {
          user_id: testUser.id,
          type: 'LOTTERY' as any,
          point_amount: 200,
          status: 'done',
          created_at: '2026-03-24T08:00:00Z',
        });

        const response = await request(app.getHttpServer())
          .get('/cashback/list')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body.items).toHaveLength(3);
        expect(response.body.items[0].type).toBe('everyReceipt');
        expect(response.body.items[1].type).toBe('stepReward');
        expect(response.body.items[2].type).toBe('lottery');
      });

      it('limit 파라미터로 반환 개수를 제한한다', async () => {
        // 여러 소스에 데이터를 넣어 합쳐진 결과가 limit 초과하도록 함
        await createEveryReceipt(supabase, {
          user_id: testUser.id,
          point: 100,
          created_at: new Date(2026, 2, 24, 12).toISOString(),
        });
        await createEveryReceipt(supabase, {
          user_id: testUser.id,
          point: 50,
          created_at: new Date(2026, 2, 24, 10).toISOString(),
        });
        await createStepReward(supabase, {
          user_id: testUser.id,
          step_count: 3000,
          point_amount: 30,
          rewarded_date: '2026-03-24',
          created_at: new Date(2026, 2, 24, 8).toISOString(),
        });

        const response = await request(app.getHttpServer())
          .get('/cashback/list?limit=2')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body.items).toHaveLength(2);
        expect(response.body.nextCursor).not.toBeNull();
      });

      it('cursor 파라미터로 다음 페이지를 조회한다', async () => {
        // 2개 소스에 각 2개씩 → 합계 4개, limit 2로 페이지네이션
        await createEveryReceipt(supabase, {
          user_id: testUser.id,
          point: 100,
          created_at: '2026-03-24T12:00:00Z',
        });
        await createEveryReceipt(supabase, {
          user_id: testUser.id,
          point: 50,
          created_at: '2026-03-24T08:00:00Z',
        });
        await createStepReward(supabase, {
          user_id: testUser.id,
          step_count: 3000,
          point_amount: 30,
          rewarded_date: '2026-03-24',
          created_at: '2026-03-24T10:00:00Z',
        });
        await createStepReward(supabase, {
          user_id: testUser.id,
          step_count: 5000,
          point_amount: 20,
          rewarded_date: '2026-03-23',
          created_at: '2026-03-24T06:00:00Z',
        });

        // 첫 페이지
        const page1 = await request(app.getHttpServer())
          .get('/cashback/list?limit=2')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(page1.body.items).toHaveLength(2);
        expect(page1.body.nextCursor).not.toBeNull();

        // 두 번째 페이지 - cursor 인코딩
        const page2 = await request(app.getHttpServer())
          .get(
            `/cashback/list?limit=2&cursor=${encodeURIComponent(page1.body.nextCursor)}`,
          )
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(page2.body.items.length).toBeGreaterThanOrEqual(1);
        // 첫 페이지 아이템과 겹치지 않아야 한다
        const page1Ids = page1.body.items.map((i: any) => i.id);
        const page2Ids = page2.body.items.map((i: any) => i.id);
        const overlap = page1Ids.filter((id: string) => page2Ids.includes(id));
        expect(overlap).toHaveLength(0);
      });

      it('기본 limit은 20이다', async () => {
        // 2개 소스에 각 11개씩 → 합계 22개, 기본 limit 20으로 잘림
        for (let i = 0; i < 11; i++) {
          await createEveryReceipt(supabase, {
            user_id: testUser.id,
            point: 10,
            created_at: new Date(2026, 2, 24 - i, 12).toISOString(),
          });
        }
        for (let i = 0; i < 11; i++) {
          await createStepReward(supabase, {
            user_id: testUser.id,
            step_count: 3000,
            point_amount: 5,
            rewarded_date: `2026-03-${String(24 - i).padStart(2, '0')}`,
            created_at: new Date(2026, 2, 24 - i, 6).toISOString(),
          });
        }

        const response = await request(app.getHttpServer())
          .get('/cashback/list')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body.items).toHaveLength(20);
        expect(response.body.nextCursor).not.toBeNull();
      });

      it('기프티콘 교환(send_status=sent) → gifticonExchange로 노출, 다른 상태는 제외', async () => {
        // smartcon_goods 시드
        await supabase.from('smartcon_goods').insert([
          {
            goods_id: 'A',
            event_id: '64385',
            brand_name: '컴포즈커피',
            goods_name: '아메리카노 ICE',
            raw_data: { GOODS_ID: 'A' },
            is_active: true,
          },
          {
            goods_id: 'B',
            event_id: '64385',
            brand_name: '이마트24',
            goods_name: '츄파춥스',
            raw_data: { GOODS_ID: 'B' },
            is_active: true,
          },
        ]);

        // sent 1건 + send_failed 1건 — sent만 노출돼야
        await supabase.from('coupon_exchanges').insert([
          {
            user_id: testUser.id,
            point_action_id: null,
            amount: 1500,
            smartcon_goods_id: 'A',
            tr_id: 'tr-sent-1',
            send_status: 'sent',
          },
          {
            user_id: testUser.id,
            point_action_id: null,
            amount: 300,
            smartcon_goods_id: 'B',
            tr_id: 'tr-failed-1',
            send_status: 'send_failed',
          },
        ]);

        const response = await request(app.getHttpServer())
          .get('/cashback/list')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        const items = response.body.items as Array<{
          type: string;
          amount: number;
          data: { brandName: string; goodsName: string };
        }>;
        const gifticonItems = items.filter(
          (i) => i.type === 'gifticonExchange',
        );
        expect(gifticonItems).toHaveLength(1);
        expect(gifticonItems[0]).toMatchObject({
          type: 'gifticonExchange',
          amount: -1500,
          data: { brandName: '컴포즈커피', goodsName: '아메리카노 ICE' },
        });
      });
    });
  });
});
