import { describe, it, expect, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { AdvertiserAuthService } from './advertiser-auth.service';
import { ADVERTISER_AUTH_REPOSITORY } from './interfaces/advertiser-auth-repository.interface';
import { StubAdvertiserAuthRepository } from './repositories/stub-advertiser-auth.repository';

const TEST_JWT_SECRET = 'test-advertiser-jwt-secret';

describe('AdvertiserAuthService', () => {
  let service: AdvertiserAuthService;
  let repository: StubAdvertiserAuthRepository;

  beforeEach(async () => {
    repository = new StubAdvertiserAuthRepository();

    const module = await Test.createTestingModule({
      providers: [
        AdvertiserAuthService,
        { provide: ADVERTISER_AUTH_REPOSITORY, useValue: repository },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'advertiser.jwtSecret') return TEST_JWT_SECRET;
              return undefined;
            },
          },
        },
      ],
    }).compile();

    service = module.get(AdvertiserAuthService);
  });

  describe('login', () => {
    it('올바른 자격증명으로 로그인 시 JWT 토큰을 반환한다', async () => {
      const passwordHash = await bcrypt.hash('correct-password', 10);
      repository.setAdvertisers([
        {
          id: 1,
          login_id: 'acme_corp',
          password_hash: passwordHash,
          company_name: '주식회사 ACME',
        },
      ]);

      const result = await service.login('acme_corp', 'correct-password');

      expect(result.accessToken).toBeDefined();
      expect(result.companyName).toBe('주식회사 ACME');

      const payload = jwt.verify(result.accessToken, TEST_JWT_SECRET) as {
        advertiserId: number;
        companyName: string;
      };
      expect(payload.advertiserId).toBe(1);
      expect(payload.companyName).toBe('주식회사 ACME');
    });

    it('존재하지 않는 login_id로 로그인 시 UnauthorizedException', async () => {
      repository.setAdvertisers([]);

      await expect(
        service.login('nonexistent', 'password'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('잘못된 비밀번호로 로그인 시 UnauthorizedException', async () => {
      const passwordHash = await bcrypt.hash('correct-password', 10);
      repository.setAdvertisers([
        {
          id: 1,
          login_id: 'acme_corp',
          password_hash: passwordHash,
          company_name: '주식회사 ACME',
        },
      ]);

      await expect(
        service.login('acme_corp', 'wrong-password'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('로그인 실패 시 login_id 존재 여부를 구분할 수 없는 동일 메시지를 반환한다', async () => {
      const passwordHash = await bcrypt.hash('correct-password', 10);
      repository.setAdvertisers([
        {
          id: 1,
          login_id: 'acme_corp',
          password_hash: passwordHash,
          company_name: '주식회사 ACME',
        },
      ]);

      // 존재하지 않는 ID
      const error1 = await service
        .login('nonexistent', 'password')
        .catch((e) => e);

      // 잘못된 비밀번호
      const error2 = await service
        .login('acme_corp', 'wrong-password')
        .catch((e) => e);

      expect(error1.message).toBe(error2.message);
    });

    it('JWT 토큰에 만료 시간이 설정되어 있다', async () => {
      const passwordHash = await bcrypt.hash('password', 10);
      repository.setAdvertisers([
        {
          id: 1,
          login_id: 'test',
          password_hash: passwordHash,
          company_name: 'Test Corp',
        },
      ]);

      const result = await service.login('test', 'password');
      const payload = jwt.decode(result.accessToken) as { exp: number; iat: number };

      expect(payload.exp).toBeDefined();
      expect(payload.exp - payload.iat).toBe(24 * 60 * 60); // 24시간
    });

    it('여러 광고주 중 올바른 광고주를 찾아 로그인한다', async () => {
      const hash1 = await bcrypt.hash('pass1', 10);
      const hash2 = await bcrypt.hash('pass2', 10);
      repository.setAdvertisers([
        { id: 1, login_id: 'corp_a', password_hash: hash1, company_name: 'A사' },
        { id: 2, login_id: 'corp_b', password_hash: hash2, company_name: 'B사' },
      ]);

      const result = await service.login('corp_b', 'pass2');

      expect(result.companyName).toBe('B사');

      const payload = jwt.verify(result.accessToken, TEST_JWT_SECRET) as {
        advertiserId: number;
      };
      expect(payload.advertiserId).toBe(2);
    });
  });

  describe('findAllAdvertisers', () => {
    it('전체 광고주 목록을 camelCase로 반환한다', async () => {
      repository.setAdvertisers([
        { id: 1, login_id: 'corp_a', password_hash: 'hash1', company_name: 'A사' },
        { id: 2, login_id: 'corp_b', password_hash: 'hash2', company_name: 'B사' },
      ]);

      const result = await service.findAllAdvertisers();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 1,
        loginId: 'corp_a',
        companyName: 'A사',
      });
      expect(result[1]).toEqual({
        id: 2,
        loginId: 'corp_b',
        companyName: 'B사',
      });
    });

    it('광고주가 없으면 빈 배열을 반환한다', async () => {
      repository.setAdvertisers([]);

      const result = await service.findAllAdvertisers();

      expect(result).toEqual([]);
    });

    it('password_hash는 응답에 포함되지 않는다', async () => {
      repository.setAdvertisers([
        { id: 1, login_id: 'corp_a', password_hash: 'secret-hash', company_name: 'A사' },
      ]);

      const result = await service.findAllAdvertisers();

      expect(result[0]).not.toHaveProperty('password_hash');
      expect(result[0]).not.toHaveProperty('passwordHash');
    });

    it('ID 오름차순으로 정렬된다', async () => {
      repository.setAdvertisers([
        { id: 3, login_id: 'corp_c', password_hash: 'h3', company_name: 'C사' },
        { id: 1, login_id: 'corp_a', password_hash: 'h1', company_name: 'A사' },
        { id: 2, login_id: 'corp_b', password_hash: 'h2', company_name: 'B사' },
      ]);

      const result = await service.findAllAdvertisers();

      expect(result.map((a) => a.id)).toEqual([1, 2, 3]);
    });
  });
});
