import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { getTestSupabaseAdminClient } from './supabase-client';
import { truncateAllTables } from './setup';
import { createTestUser } from './helpers/user.helper';
import { generateTestToken, generateInvalidToken } from './helpers/auth.helper';
import { WATCHED_AD_REPOSITORY } from '../src/watched-ad/interfaces/watched-ad-repository.interface';
import { StubWatchedAdRepository } from '../src/watched-ad/repositories/stub-watched-ad.repository';

describe('WatchedAd API (e2e)', () => {
  let app: INestApplication;
  let stubRepository: StubWatchedAdRepository;
  const supabase = getTestSupabaseAdminClient();

  beforeAll(async () => {
    stubRepository = new StubWatchedAdRepository();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(WATCHED_AD_REPOSITORY)
      .useValue(stubRepository)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await truncateAllTables();
    await app.close();
  });

  beforeEach(async () => {
    await truncateAllTables();
    stubRepository.clear();
  });

  describe('GET /watched-ad-status', () => {
    it('토큰 없이 요청하면 401을 반환한다', async () => {
      const response = await request(app.getHttpServer())
        .get('/watched-ad-status')
        .expect(401);

      expect(response.body.message).toBe('No token provided');
    });

    it('잘못된 토큰으로 요청하면 401을 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const invalidToken = generateInvalidToken(testUser.auth_id);

      const response = await request(app.getHttpServer())
        .get('/watched-ad-status')
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(401);

      expect(response.body.message).toBe('Invalid token');
    });

    it('광고 시청 여부를 반환한다 (boolean)', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const response = await request(app.getHttpServer())
        .get('/watched-ad-status')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(typeof response.body).toBe('boolean');
    });

    it('새 유저는 광고 시청 여부가 false이다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const response = await request(app.getHttpServer())
        .get('/watched-ad-status')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toBe(false);
    });

    it('다른 유저가 광고를 시청해도 내 상태는 영향받지 않는다', async () => {
      const userA = await createTestUser(supabase);
      const userB = await createTestUser(supabase);
      const tokenA = generateTestToken(userA.auth_id);
      const tokenB = generateTestToken(userB.auth_id);

      // User A가 광고 시청
      await request(app.getHttpServer())
        .post('/watched-ad-status')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(201);

      // User A는 true
      const responseA = await request(app.getHttpServer())
        .get('/watched-ad-status')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);
      expect(responseA.body).toBe(true);

      // User B는 여전히 false
      const responseB = await request(app.getHttpServer())
        .get('/watched-ad-status')
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(200);
      expect(responseB.body).toBe(false);
    });
  });

  describe('POST /watched-ad-status', () => {
    it('토큰 없이 요청하면 401을 반환한다', async () => {
      await request(app.getHttpServer()).post('/watched-ad-status').expect(401);
    });

    it('광고 시청 완료를 기록하고 success: true를 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const response = await request(app.getHttpServer())
        .post('/watched-ad-status')
        .set('Authorization', `Bearer ${token}`)
        .expect(201);

      expect(response.body).toEqual({ success: true });
    });
  });
});
