import { describe, it, expect, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { NaverPayService } from './naver-pay.service';
import { NAVER_PAY_REPOSITORY } from './interfaces/naver-pay-repository.interface';
import { DAOU_API_CLIENT } from './interfaces/daou-api-client.interface';
import { StubNaverPayRepository } from './repositories/stub-naver-pay.repository';
import { StubDaouApiClient } from './clients/stub-daou-api.client';
import type { NaverPayAccount } from './interfaces/naver-pay-repository.interface';

describe('NaverPayService', () => {
  let service: NaverPayService;
  let repository: StubNaverPayRepository;
  let daouClient: StubDaouApiClient;
  const userId = 'test-user-id';

  beforeEach(async () => {
    repository = new StubNaverPayRepository();
    daouClient = new StubDaouApiClient();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NaverPayService,
        {
          provide: NAVER_PAY_REPOSITORY,
          useValue: repository,
        },
        {
          provide: DAOU_API_CLIENT,
          useValue: daouClient,
        },
      ],
    }).compile();

    service = module.get<NaverPayService>(NaverPayService);
  });

  describe('getAccount', () => {
    it('연결된 계정이 있으면 connected 응답을 반환한다', async () => {
      repository.setAccounts([
        createAccount({ user_id: userId, status: 'connected' }),
      ]);

      const result = await service.getAccount(userId);

      expect(result).toEqual({
        connected: true,
        maskingId: 'nav***',
        connectedAt: '2026-03-16T12:00:00Z',
      });
    });

    it('연결된 계정이 없으면 connected: false를 반환한다', async () => {
      const result = await service.getAccount(userId);

      expect(result).toEqual({ connected: false });
    });

    it('disconnected 상태 계정만 있으면 connected: false를 반환한다', async () => {
      repository.setAccounts([
        createAccount({ user_id: userId, status: 'disconnected' }),
      ]);

      const result = await service.getAccount(userId);

      expect(result).toEqual({ connected: false });
    });

    it('failed 상태 계정만 있으면 connected: false를 반환한다', async () => {
      repository.setAccounts([
        createAccount({ user_id: userId, status: 'failed' }),
      ]);

      const result = await service.getAccount(userId);

      expect(result).toEqual({ connected: false });
    });

    it('다른 유저의 connected 계정은 반환하지 않는다', async () => {
      repository.setAccounts([
        createAccount({ user_id: 'other-user', status: 'connected' }),
      ]);

      const result = await service.getAccount(userId);

      expect(result).toEqual({ connected: false });
    });
  });

  describe('connectAccount', () => {
    it('다우 API 성공 시 connected 계정을 생성하고 성공 응답을 반환한다', async () => {
      daouClient.setSuccess('nav***', 3500, 'user-key-123');

      const result = await service.connectAccount(userId, 'unique-id-abc');

      expect(result).toEqual({
        success: true,
        data: {
          maskingId: 'nav***',
          naverPayPoint: 3500,
        },
      });

      const accounts = repository.getInsertedAccounts();
      expect(accounts).toHaveLength(1);
      expect(accounts[0].status).toBe('connected');
      expect(accounts[0].dau_user_key).toBe('user-key-123');
      expect(accounts[0].dau_masking_id).toBe('nav***');
      expect(accounts[0].naver_unique_id).toBe('unique-id-abc');
    });

    it('이미 connected 계정이 있으면 BadRequestException', async () => {
      repository.setAccounts([
        createAccount({ user_id: userId, status: 'connected' }),
      ]);

      await expect(
        service.connectAccount(userId, 'unique-id-abc'),
      ).rejects.toThrow(BadRequestException);
    });

    it('일일 시도 횟수 초과 시 BadRequestException', async () => {
      const failedAccounts = Array.from({ length: 5 }, (_, i) =>
        createAccount({
          id: `failed-${i}`,
          user_id: userId,
          status: 'failed',
          created_at: new Date().toISOString(),
        }),
      );
      repository.setAccounts(failedAccounts);

      await expect(
        service.connectAccount(userId, 'unique-id-abc'),
      ).rejects.toThrow(BadRequestException);
    });

    it('일일 시도 횟수가 제한 미만이면 연결 가능하다', async () => {
      const failedAccounts = Array.from({ length: 4 }, (_, i) =>
        createAccount({
          id: `failed-${i}`,
          user_id: userId,
          status: 'failed',
          created_at: new Date().toISOString(),
        }),
      );
      repository.setAccounts(failedAccounts);
      daouClient.setSuccess();

      const result = await service.connectAccount(userId, 'unique-id-abc');

      expect(result.success).toBe(true);
    });

    it('다우 API 실패 시 failed 계정을 생성하고 에러 응답을 반환한다', async () => {
      daouClient.setFailure('52004');

      const result = await service.connectAccount(userId, 'unique-id-abc');

      expect(result).toEqual({
        success: false,
        errorCode: '52004',
        errorMessage: '네이버페이 가입 후 다시 시도해주세요',
      });

      const accounts = repository.getInsertedAccounts();
      expect(accounts).toHaveLength(1);
      expect(accounts[0].status).toBe('failed');
      expect(accounts[0].error_code).toBe('52004');
      expect(accounts[0].dau_user_key).toBeNull();
    });

    it('다우 API 실패 시 에러코드 52001이면 휴면 안내 메시지를 반환한다', async () => {
      daouClient.setFailure('52001');

      const result = await service.connectAccount(userId, 'unique-id-abc');

      expect(result.errorMessage).toBe(
        '네이버페이 계정 상태를 확인해주세요',
      );
    });

    it('다우 API 실패 시 에러코드 52002이면 블랙 안내 메시지를 반환한다', async () => {
      daouClient.setFailure('52002');

      const result = await service.connectAccount(userId, 'unique-id-abc');

      expect(result.errorMessage).toBe(
        '네이버페이 계정 상태를 확인해주세요',
      );
    });

    it('다우 API 실패 시 알 수 없는 에러코드면 기본 메시지를 반환한다', async () => {
      daouClient.setFailure('99999');

      const result = await service.connectAccount(userId, 'unique-id-abc');

      expect(result.errorMessage).toBe(
        '네이버페이 연결에 실패했습니다. 잠시 후 다시 시도해주세요',
      );
    });

    it('uniqueId가 빈 문자열이면 BadRequestException', async () => {
      await expect(service.connectAccount(userId, '')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('disconnected 계정만 있으면 새로 연결할 수 있다', async () => {
      repository.setAccounts([
        createAccount({ user_id: userId, status: 'disconnected' }),
      ]);
      daouClient.setSuccess();

      const result = await service.connectAccount(userId, 'unique-id-abc');

      expect(result.success).toBe(true);
    });

    it('failed 계정만 있으면 새로 연결할 수 있다', async () => {
      repository.setAccounts([
        createAccount({
          user_id: userId,
          status: 'failed',
          created_at: '2025-01-01T00:00:00Z',
        }),
      ]);
      daouClient.setSuccess();

      const result = await service.connectAccount(userId, 'unique-id-abc');

      expect(result.success).toBe(true);
    });
  });

  describe('disconnectAccount', () => {
    it('연결된 계정을 해제한다', async () => {
      repository.setAccounts([
        createAccount({ id: 'acc-1', user_id: userId, status: 'connected' }),
      ]);

      const result = await service.disconnectAccount(userId);

      expect(result).toEqual({ success: true });

      const account = await repository.findConnectedAccount(userId);
      expect(account).toBeNull();
    });

    it('연결된 계정이 없으면 NotFoundException', async () => {
      await expect(service.disconnectAccount(userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('disconnected 계정만 있으면 NotFoundException', async () => {
      repository.setAccounts([
        createAccount({ user_id: userId, status: 'disconnected' }),
      ]);

      await expect(service.disconnectAccount(userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('failed 계정만 있으면 NotFoundException', async () => {
      repository.setAccounts([
        createAccount({ user_id: userId, status: 'failed' }),
      ]);

      await expect(service.disconnectAccount(userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('다른 유저의 connected 계정은 해제하지 않는다', async () => {
      repository.setAccounts([
        createAccount({ user_id: 'other-user', status: 'connected' }),
      ]);

      await expect(service.disconnectAccount(userId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});

function createAccount(
  overrides: Partial<NaverPayAccount> = {},
): NaverPayAccount {
  return {
    id: 'account-1',
    user_id: 'test-user-id',
    naver_unique_id: 'unique-id-abc',
    dau_user_key: 'user-key-123',
    dau_masking_id: 'nav***',
    status: 'connected',
    error_code: null,
    connected_at: '2026-03-16T12:00:00Z',
    disconnected_at: null,
    created_at: '2026-03-16T12:00:00Z',
    ...overrides,
  };
}
