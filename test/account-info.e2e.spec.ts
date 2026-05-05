import * as crypto from 'crypto';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { getTestSupabaseAdminClient } from './supabase-client';
import { truncateAllTables } from './setup';
import { createTestUser } from './helpers/user.helper';
import { generateTestToken } from './helpers/auth.helper';
import {
  createAccountInfo,
  encryptAccountNumber,
} from './helpers/account-info.helper';

describe('AccountInfo API (e2e)', () => {
  let app: INestApplication;
  const supabase = getTestSupabaseAdminClient();

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
  });

  describe('GET /account-info', () => {
    it('토큰 없이 요청하면 401을 반환한다', async () => {
      const response = await request(app.getHttpServer())
        .get('/account-info')
        .expect(401);

      expect(response.body.message).toBe('No token provided');
    });

    it('계좌 정보가 없으면 null을 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const response = await request(app.getHttpServer())
        .get('/account-info')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toEqual({});
    });

    it('계좌 정보가 있으면 복호화된 정보를 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const encrypted = encryptAccountNumber('1234567890');
      await createAccountInfo(supabase, {
        user_id: testUser.id,
        account_bank: '국민은행',
        account_number: encrypted,
        account_user_name: '홍길동',
        display_number: '7890',
      });

      const response = await request(app.getHttpServer())
        .get('/account-info')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.accountBank).toBe('국민은행');
      expect(response.body.displayNumber).toBe('7890');
      expect(response.body.accountNumberLength).toBe(10);
      expect(response.body.accountName).toBe('홍길동');
    });

    it('여러 계좌가 있으면 최신 것을 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      await createAccountInfo(supabase, {
        user_id: testUser.id,
        account_bank: '국민은행',
        account_number: encryptAccountNumber('11122233344'),
        account_user_name: '홍길동',
        display_number: '3344',
        created_at: '2026-01-01T00:00:00Z',
      });

      await createAccountInfo(supabase, {
        user_id: testUser.id,
        account_bank: '신한은행',
        account_number: encryptAccountNumber('44455566677'),
        account_user_name: '홍길동',
        display_number: '6677',
        created_at: '2026-01-02T00:00:00Z',
      });

      const response = await request(app.getHttpServer())
        .get('/account-info')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.accountBank).toBe('신한은행');
      expect(response.body.displayNumber).toBe('6677');
    });

    it('다른 유저의 계좌 정보는 조회되지 않는다', async () => {
      const userA = await createTestUser(supabase);
      const userB = await createTestUser(supabase);
      const tokenB = generateTestToken(userB.auth_id);

      await createAccountInfo(supabase, {
        user_id: userA.id,
        account_bank: '국민은행',
        account_number: encryptAccountNumber('1234567890'),
        account_user_name: '홍길동',
        display_number: '7890',
      });

      const response = await request(app.getHttpServer())
        .get('/account-info')
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(200);

      expect(response.body).toEqual({});
    });

    it('계좌번호 자체는 응답에 포함되지 않고 길이만 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      await createAccountInfo(supabase, {
        user_id: testUser.id,
        account_bank: '국민은행',
        account_number: encryptAccountNumber('12345678901234'),
        account_user_name: '홍길동',
        display_number: '1234',
      });

      const response = await request(app.getHttpServer())
        .get('/account-info')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).not.toHaveProperty('accountNumber');
      expect(response.body.accountNumberLength).toBe(14);
    });
  });

  describe('POST /account-info', () => {
    it('토큰 없이 요청하면 401을 반환한다', async () => {
      const response = await request(app.getHttpServer())
        .post('/account-info')
        .send({
          bank: '국민은행',
          accountHolder: '홍길동',
          accountNumber: '12345678901234',
        })
        .expect(401);

      expect(response.body.message).toBe('No token provided');
    });

    it('평문 계좌번호로 정상 등록된다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const response = await request(app.getHttpServer())
        .post('/account-info')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bank: '국민은행',
          accountHolder: '홍길동',
          accountNumber: '12345678901234',
        })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: '계좌 정보가 등록되었습니다.',
      });
    });

    it('등록 후 DB에 암호화된 계좌번호가 저장된다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      await request(app.getHttpServer())
        .post('/account-info')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bank: '국민은행',
          accountHolder: '홍길동',
          accountNumber: '12345678901234',
        })
        .expect(200);

      const { data } = await supabase
        .from('account_info')
        .select('*')
        .eq('user_id', testUser.id)
        .single();

      expect(data).not.toBeNull();
      expect(data!.account_bank).toBe('국민은행');
      expect(data!.account_user_name).toBe('홍길동');
      expect(data!.display_number).toBe('1234');
      // 암호화되어 있으므로 원본과 다르고 base64 344자
      expect(data!.account_number).not.toBe('12345678901234');
      expect(data!.account_number.length).toBe(344);
    });

    it('등록 후 GET으로 조회하면 정보가 일치한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      await request(app.getHttpServer())
        .post('/account-info')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bank: '신한은행',
          accountHolder: '김철수',
          accountNumber: '11023456786789',
        })
        .expect(200);

      const response = await request(app.getHttpServer())
        .get('/account-info')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.accountBank).toBe('신한은행');
      expect(response.body.accountName).toBe('김철수');
      expect(response.body.displayNumber).toBe('6789');
      expect(response.body.accountNumberLength).toBe(14);
    });

    it('필수 필드가 빠지면 400을 반환한다 (bank 누락)', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      await request(app.getHttpServer())
        .post('/account-info')
        .set('Authorization', `Bearer ${token}`)
        .send({
          accountHolder: '홍길동',
          accountNumber: '12345678901234',
        })
        .expect(400);
    });

    it('필수 필드가 빠지면 400을 반환한다 (accountHolder 누락)', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      await request(app.getHttpServer())
        .post('/account-info')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bank: '국민은행',
          accountNumber: '12345678901234',
        })
        .expect(400);
    });

    it('필수 필드가 빠지면 400을 반환한다 (accountNumber 누락)', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      await request(app.getHttpServer())
        .post('/account-info')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bank: '국민은행',
          accountHolder: '홍길동',
        })
        .expect(400);
    });

    it('계좌번호에 허용되지 않는 문자가 있으면 400을 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      await request(app.getHttpServer())
        .post('/account-info')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bank: '국민은행',
          accountHolder: '홍길동',
          accountNumber: '123abc456',
        })
        .expect(400);
    });

    it('계좌번호에 특수문자가 있으면 400을 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      await request(app.getHttpServer())
        .post('/account-info')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bank: '국민은행',
          accountHolder: '홍길동',
          accountNumber: '123!@#456',
        })
        .expect(400);
    });

    it('하이픈이 포함된 계좌번호는 400을 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      await request(app.getHttpServer())
        .post('/account-info')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bank: '국민은행',
          accountHolder: '홍길동',
          accountNumber: '123-456-789',
        })
        .expect(400);
    });

    it('너무 짧은 계좌번호(7자리)는 400을 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      await request(app.getHttpServer())
        .post('/account-info')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bank: '국민은행',
          accountHolder: '홍길동',
          accountNumber: '1234567',
        })
        .expect(400);
    });

    it('너무 긴 계좌번호(21자리)는 400을 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      await request(app.getHttpServer())
        .post('/account-info')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bank: '국민은행',
          accountHolder: '홍길동',
          accountNumber: '123456789012345678901',
        })
        .expect(400);
    });

    describe('클라이언트 암호화 입력 (RSA-2048-OAEP base64 344자)', () => {
      it('암호문 입력으로도 정상 등록된다', async () => {
        const testUser = await createTestUser(supabase);
        const token = generateTestToken(testUser.auth_id);

        const ciphertext = encryptAccountNumber('12345678901234');
        expect(ciphertext.length).toBe(344);

        const response = await request(app.getHttpServer())
          .post('/account-info')
          .set('Authorization', `Bearer ${token}`)
          .send({
            bank: '국민은행',
            accountHolder: '홍길동',
            accountNumber: ciphertext,
          })
          .expect(200);

        expect(response.body.success).toBe(true);
      });

      it('암호문으로 등록 후 조회하면 평문 등록과 동일한 결과가 나온다', async () => {
        const testUser = await createTestUser(supabase);
        const token = generateTestToken(testUser.auth_id);

        const ciphertext = encryptAccountNumber('11023456786789');

        await request(app.getHttpServer())
          .post('/account-info')
          .set('Authorization', `Bearer ${token}`)
          .send({
            bank: '신한은행',
            accountHolder: '김철수',
            accountNumber: ciphertext,
          })
          .expect(200);

        const response = await request(app.getHttpServer())
          .get('/account-info')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body.accountBank).toBe('신한은행');
        expect(response.body.accountName).toBe('김철수');
        expect(response.body.displayNumber).toBe('6789');
        expect(response.body.accountNumberLength).toBe(14);
      });

      it('복호화 불가능한 344자 base64 입력은 400을 반환한다', async () => {
        const testUser = await createTestUser(supabase);
        const token = generateTestToken(testUser.auth_id);

        // 256바이트 랜덤 → base64 344자 (이 키로 복호화 불가)
        const garbage = crypto.randomBytes(256).toString('base64');
        expect(garbage.length).toBe(344);

        await request(app.getHttpServer())
          .post('/account-info')
          .set('Authorization', `Bearer ${token}`)
          .send({
            bank: '국민은행',
            accountHolder: '홍길동',
            accountNumber: garbage,
          })
          .expect(400);
      });

      it('복호화 결과가 8~20자리 숫자 형식이 아니면 400을 반환한다', async () => {
        const testUser = await createTestUser(supabase);
        const token = generateTestToken(testUser.auth_id);

        const ciphertext = encryptAccountNumber('not-a-number-abc');

        await request(app.getHttpServer())
          .post('/account-info')
          .set('Authorization', `Bearer ${token}`)
          .send({
            bank: '국민은행',
            accountHolder: '홍길동',
            accountNumber: ciphertext,
          })
          .expect(400);
      });
    });
  });
});
