import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { getTestSupabaseAdminClient } from './supabase-client';
import { truncateAllTables } from './setup';
import { createTestUser, TestUser } from './helpers/user.helper';
import { generateTestToken } from './helpers/auth.helper';

describe('UserInfo (e2e) - Real DB', () => {
  let app: INestApplication;
  const supabase = getTestSupabaseAdminClient();
  let testUser: TestUser;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await truncateAllTables();
    await app.close();
  });

  beforeEach(async () => {
    await truncateAllTables();
    testUser = await createTestUser(supabase);
    authToken = generateTestToken(testUser.auth_id);
  });

  describe('GET /user-info/phone', () => {
    it('인증 없이 호출 → 401', async () => {
      await request(app.getHttpServer()).get('/user-info/phone').expect(401);
    });

    it('등록된 적 없으면 phone null', async () => {
      const response = await request(app.getHttpServer())
        .get('/user-info/phone')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      expect(response.body).toEqual({ phone: null });
    });
  });

  describe('PUT /user-info/phone', () => {
    it('하이픈 포함 입력 → 정규화 후 저장', async () => {
      const response = await request(app.getHttpServer())
        .put('/user-info/phone')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ phone: '010-1234-5678' })
        .expect(200);

      expect(response.body).toEqual({ phone: '01012345678' });

      // DB 확인
      const { data } = await supabase
        .from('user_info')
        .select('phone_number, user_id')
        .eq('user_id', testUser.id)
        .single();
      expect(data?.phone_number).toBe('01012345678');
    });

    it('두 번째 호출 → UPDATE (행 1개 유지)', async () => {
      await request(app.getHttpServer())
        .put('/user-info/phone')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ phone: '01012345678' })
        .expect(200);

      const second = await request(app.getHttpServer())
        .put('/user-info/phone')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ phone: '01099998888' })
        .expect(200);

      expect(second.body.phone).toBe('01099998888');

      const { data, error } = await supabase
        .from('user_info')
        .select('id, phone_number')
        .eq('user_id', testUser.id);
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data?.[0].phone_number).toBe('01099998888');
    });

    it('등록 후 GET → 같은 값 반환', async () => {
      await request(app.getHttpServer())
        .put('/user-info/phone')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ phone: '01012345678' })
        .expect(200);

      const get = await request(app.getHttpServer())
        .get('/user-info/phone')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      expect(get.body).toEqual({ phone: '01012345678' });
    });

    it('잘못된 형식 → 400', async () => {
      await request(app.getHttpServer())
        .put('/user-info/phone')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ phone: '02-1234-5678' })
        .expect(400);
    });

    it('phone 누락 → 400', async () => {
      await request(app.getHttpServer())
        .put('/user-info/phone')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);
    });

    it('인증 없이 호출 → 401', async () => {
      await request(app.getHttpServer())
        .put('/user-info/phone')
        .send({ phone: '01012345678' })
        .expect(401);
    });

    it('두 사용자가 같은 번호 등록해도 충돌 X', async () => {
      const otherUser = await createTestUser(supabase);
      const otherToken = generateTestToken(otherUser.auth_id);

      await request(app.getHttpServer())
        .put('/user-info/phone')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ phone: '01012345678' })
        .expect(200);

      await request(app.getHttpServer())
        .put('/user-info/phone')
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ phone: '01012345678' })
        .expect(200);
    });
  });
});
