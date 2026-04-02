import { describe, it, expect, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { NaverPayService } from './naver-pay.service';
import { NAVER_PAY_REPOSITORY } from './interfaces/naver-pay-repository.interface';
import { DAOU_API_CLIENT } from './interfaces/daou-api-client.interface';
import { StubNaverPayRepository } from './repositories/stub-naver-pay.repository';
import { StubDaouApiClient } from './clients/stub-daou-api.client';
import { PointService } from '../point/point.service';
import { SlackService } from '../slack/slack.service';
import { USER_MODAL_REPOSITORY } from '../user-modal/interfaces/user-modal-repository.interface';
import { StubUserModalRepository } from '../user-modal/repositories/stub-user-modal.repository';
import { FcmService } from '../fcm/fcm.service';
import type {
  NaverPayAccount,
  NaverPayExchange,
} from './interfaces/naver-pay-repository.interface';

// PointService stub
class StubPointService {
  private totalPoint = 10000;
  private deductions: { userId: string; amount: number; type: string }[] = [];
  private restorations: {
    userId: string;
    amount: number;
    type: string;
    originalPointActionId: number;
  }[] = [];
  private nextPointActionId = 1;

  setTotalPoint(point: number): void {
    this.totalPoint = point;
  }

  getDeductions() {
    return this.deductions;
  }

  getRestorations() {
    return this.restorations;
  }

  clear(): void {
    this.deductions = [];
    this.restorations = [];
    this.nextPointActionId = 1;
  }

  async getPointTotal(_userId: string) {
    return {
      totalPoint: this.totalPoint,
      expiringPoints: 0,
      expiringDate: '2026-03-31',
      todayPoint: 0,
      lastWeekPoint: 0,
      weeklyPoint: 0,
    };
  }

  async deductPoint(userId: string, amount: number, type: string) {
    const pointActionId = this.nextPointActionId++;
    this.deductions.push({ userId, amount, type });
    return { pointActionId };
  }

  async restorePoint(
    userId: string,
    amount: number,
    type: string,
    originalPointActionId: number,
  ) {
    this.restorations.push({ userId, amount, type, originalPointActionId });
  }
}

describe('NaverPayService', () => {
  let service: NaverPayService;
  let repository: StubNaverPayRepository;
  let daouClient: StubDaouApiClient;
  let pointService: StubPointService;
  const userId = 'test-user-id';

  beforeEach(async () => {
    repository = new StubNaverPayRepository();
    daouClient = new StubDaouApiClient();
    pointService = new StubPointService();

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
        {
          provide: PointService,
          useValue: pointService,
        },
        {
          provide: SlackService,
          useValue: { reportBugToSlack: async () => {} },
        },
        {
          provide: USER_MODAL_REPOSITORY,
          useValue: new StubUserModalRepository(),
        },
        {
          provide: FcmService,
          useValue: {
            pushNotification: async () => {},
            sendRefreshMessage: async () => {},
          },
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
      daouClient.setMemberSuccess('nav***', 3500, 'user-key-123');

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
      daouClient.setMemberSuccess();

      const result = await service.connectAccount(userId, 'unique-id-abc');

      expect(result.success).toBe(true);
    });

    it('다우 API 실패 시 failed 계정을 생성하고 에러 응답을 반환한다', async () => {
      daouClient.setMemberFailure('52004');

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
      daouClient.setMemberFailure('52001');

      const result = await service.connectAccount(userId, 'unique-id-abc');

      expect(result.errorMessage).toBe('네이버페이 계정 상태를 확인해주세요');
    });

    it('다우 API 실패 시 에러코드 52002이면 블랙 안내 메시지를 반환한다', async () => {
      daouClient.setMemberFailure('52002');

      const result = await service.connectAccount(userId, 'unique-id-abc');

      expect(result.errorMessage).toBe('네이버페이 계정 상태를 확인해주세요');
    });

    it('다우 API 실패 시 알 수 없는 에러코드면 기본 메시지를 반환한다', async () => {
      daouClient.setMemberFailure('99999');

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
      daouClient.setMemberSuccess();

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
      daouClient.setMemberSuccess();

      const result = await service.connectAccount(userId, 'unique-id-abc');

      expect(result.success).toBe(true);
    });
  });

  describe('disconnectAccount', () => {
    it('연결된 계정을 해제하고 민감정보를 삭제한다', async () => {
      repository.setAccounts([
        createAccount({ id: 'acc-1', user_id: userId, status: 'connected' }),
      ]);

      const result = await service.disconnectAccount(userId);

      expect(result).toEqual({ success: true });

      // connected 계정은 없어야 함
      const account = await repository.findConnectedAccount(userId);
      expect(account).toBeNull();

      // 민감정보 삭제 확인
      const allAccounts = repository.getInsertedAccounts();
      const disconnected = allAccounts.find((a) => a.id === 'acc-1');
      expect(disconnected?.status).toBe('disconnected');
      expect(disconnected?.naver_unique_id).toBeNull();
      expect(disconnected?.dau_user_key).toBeNull();
      expect(disconnected?.dau_masking_id).toBeNull();
      expect(disconnected?.disconnected_at).not.toBeNull();
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

    it('pending 전환 요청이 있으면 해제를 거부한다', async () => {
      repository.setAccounts([
        createAccount({ id: 'acc-1', user_id: userId, status: 'connected' }),
      ]);
      repository.setExchanges([
        createExchange({
          id: 'ex-1',
          user_id: userId,
          naver_pay_account_id: 'acc-1',
          status: 'pending',
        }),
      ]);

      await expect(service.disconnectAccount(userId)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.disconnectAccount(userId)).rejects.toThrow(
        '진행 중인 전환 요청이 있습니다',
      );

      // 계정은 여전히 connected
      const account = await repository.findConnectedAccount(userId);
      expect(account).not.toBeNull();
    });
  });

  // --- 포인트 전환 ---

  describe('createExchange', () => {
    beforeEach(() => {
      repository.setAccounts([
        createAccount({ id: 'acc-1', user_id: userId, status: 'connected' }),
      ]);
      pointService.setTotalPoint(10000);
    });

    it('정상 전환 요청 시 exchange와 포인트 차감이 생성된다', async () => {
      const result = await service.createExchange(userId, 5000);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        exchangeId: expect.any(String),
        cashmorePoint: 5000,
        naverpayPoint: 5050,
        status: 'pending',
      });

      // exchange row 생성 확인
      const exchanges = repository.getInsertedExchanges();
      expect(exchanges).toHaveLength(1);
      expect(exchanges[0].cashmore_point).toBe(5000);
      expect(exchanges[0].naverpay_point).toBe(5050);
      expect(exchanges[0].exchange_rate).toBe(1.01);
      expect(exchanges[0].status).toBe('pending');
      expect(exchanges[0].naver_pay_account_id).toBe('acc-1');

      // 포인트 차감 확인
      const deductions = pointService.getDeductions();
      expect(deductions).toHaveLength(1);
      expect(deductions[0].amount).toBe(5000);
      expect(deductions[0].type).toBe('EXCHANGE_POINT_TO_NAVERPAY');
    });

    it('최소 금액 미만이면 BadRequestException', async () => {
      await expect(service.createExchange(userId, 999)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.createExchange(userId, 999)).rejects.toThrow(
        '최소 1000P부터 전환 가능합니다',
      );
    });

    it('최소 금액 경계값 1000P는 성공한다', async () => {
      const result = await service.createExchange(userId, 1000);

      expect(result.success).toBe(true);
      expect(result.data?.cashmorePoint).toBe(1000);
      expect(result.data?.naverpayPoint).toBe(1010);
    });

    it('네이버페이 계정이 미연결이면 BadRequestException', async () => {
      repository.clear();

      await expect(service.createExchange(userId, 5000)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.createExchange(userId, 5000)).rejects.toThrow(
        '네이버페이 계정을 먼저 연결해주세요',
      );
    });

    it('일일 요청 제한 초과 시 BadRequestException', async () => {
      repository.setExchanges([
        createExchange({
          user_id: userId,
          created_at: new Date().toISOString(),
        }),
      ]);

      await expect(service.createExchange(userId, 5000)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.createExchange(userId, 5000)).rejects.toThrow(
        '오늘 이미 전환 요청을 하셨습니다',
      );
    });

    it('보유 포인트 부족 시 BadRequestException', async () => {
      pointService.setTotalPoint(4999);

      await expect(service.createExchange(userId, 5000)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.createExchange(userId, 5000)).rejects.toThrow(
        '포인트가 부족합니다',
      );
    });

    it('보유 포인트와 동일한 금액은 성공한다', async () => {
      pointService.setTotalPoint(5000);

      const result = await service.createExchange(userId, 5000);

      expect(result.success).toBe(true);
    });
  });

  describe('cancelExchange', () => {
    it('pending 상태의 본인 요청을 취소하고 포인트를 복원한다', async () => {
      repository.setExchanges([
        createExchange({
          id: 'ex-1',
          user_id: userId,
          status: 'pending',
          cashmore_point: 5000,
          point_action_id: 42,
        }),
      ]);

      const result = await service.cancelExchange(userId, 'ex-1');

      expect(result).toEqual({ success: true });

      // 상태 변경 확인
      const exchanges = repository.getInsertedExchanges();
      expect(exchanges[0].status).toBe('cancelled');
      expect(exchanges[0].processed_at).not.toBeNull();

      // 포인트 복원 확인
      const restorations = pointService.getRestorations();
      expect(restorations).toHaveLength(1);
      expect(restorations[0].amount).toBe(5000);
      expect(restorations[0].type).toBe('EXCHANGE_POINT_TO_NAVERPAY');
      expect(restorations[0].originalPointActionId).toBe(42);
    });

    it('존재하지 않는 전환 요청이면 NotFoundException', async () => {
      await expect(
        service.cancelExchange(userId, 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('다른 유저의 전환 요청은 취소할 수 없다', async () => {
      repository.setExchanges([
        createExchange({
          id: 'ex-1',
          user_id: 'other-user',
          status: 'pending',
        }),
      ]);

      await expect(service.cancelExchange(userId, 'ex-1')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.cancelExchange(userId, 'ex-1')).rejects.toThrow(
        '본인의 전환 요청만 취소할 수 있습니다',
      );
    });

    it('pending이 아닌 상태의 요청은 취소할 수 없다 (approved)', async () => {
      repository.setExchanges([
        createExchange({
          id: 'ex-1',
          user_id: userId,
          status: 'approved',
        }),
      ]);

      await expect(service.cancelExchange(userId, 'ex-1')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.cancelExchange(userId, 'ex-1')).rejects.toThrow(
        '대기 중인 요청만 취소할 수 있습니다',
      );
    });

    it('pending이 아닌 상태의 요청은 취소할 수 없다 (completed)', async () => {
      repository.setExchanges([
        createExchange({
          id: 'ex-1',
          user_id: userId,
          status: 'completed',
        }),
      ]);

      await expect(service.cancelExchange(userId, 'ex-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('pending이 아닌 상태의 요청은 취소할 수 없다 (cancelled)', async () => {
      repository.setExchanges([
        createExchange({
          id: 'ex-1',
          user_id: userId,
          status: 'cancelled',
        }),
      ]);

      await expect(service.cancelExchange(userId, 'ex-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('pending이 아닌 상태의 요청은 취소할 수 없다 (rejected)', async () => {
      repository.setExchanges([
        createExchange({
          id: 'ex-1',
          user_id: userId,
          status: 'rejected',
        }),
      ]);

      await expect(service.cancelExchange(userId, 'ex-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('pending이 아닌 상태의 요청은 취소할 수 없다 (failed)', async () => {
      repository.setExchanges([
        createExchange({
          id: 'ex-1',
          user_id: userId,
          status: 'failed',
        }),
      ]);

      await expect(service.cancelExchange(userId, 'ex-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getExchanges', () => {
    it('전환 내역을 반환한다', async () => {
      repository.setExchanges([
        createExchange({
          id: 'ex-1',
          user_id: userId,
          cashmore_point: 5000,
          naverpay_point: 5000,
          status: 'completed',
          processed_at: '2026-03-16T14:00:00Z',
        }),
        createExchange({
          id: 'ex-2',
          user_id: userId,
          cashmore_point: 3000,
          naverpay_point: 3000,
          status: 'pending',
        }),
      ]);

      const result = await service.getExchanges(userId);

      expect(result.exchanges).toHaveLength(2);
      expect(result.exchanges[0]).toEqual({
        id: 'ex-1',
        cashmorePoint: 5000,
        naverpayPoint: 5000,
        status: 'completed',
        createdAt: '2026-03-16T12:00:00Z',
        processedAt: '2026-03-16T14:00:00Z',
      });
      expect(result.exchanges[1].processedAt).toBeUndefined();
    });

    it('전환 내역이 없으면 빈 배열을 반환한다', async () => {
      const result = await service.getExchanges(userId);

      expect(result.exchanges).toEqual([]);
    });

    it('다른 유저의 전환 내역은 포함하지 않는다', async () => {
      repository.setExchanges([createExchange({ user_id: 'other-user' })]);

      const result = await service.getExchanges(userId);

      expect(result.exchanges).toEqual([]);
    });
  });

  describe('cancelExchange - 취소 후 재요청', () => {
    beforeEach(() => {
      repository.setAccounts([
        createAccount({ id: 'acc-1', user_id: userId, status: 'connected' }),
      ]);
      pointService.setTotalPoint(10000);
    });

    it('취소한 후에는 다시 전환 요청할 수 있다', async () => {
      // 첫 요청
      const first = await service.createExchange(userId, 5000);
      expect(first.success).toBe(true);

      // 취소
      await service.cancelExchange(userId, first.data.exchangeId);

      // 재요청 가능
      const second = await service.createExchange(userId, 3000);
      expect(second.success).toBe(true);
    });
  });

  // --- 관리자용 ---

  describe('getExchangesByStatus', () => {
    it('status 필터 없이 전체 목록을 반환한다', async () => {
      repository.setExchanges([
        createExchange({ id: 'ex-1', status: 'pending' }),
        createExchange({ id: 'ex-2', status: 'completed' }),
      ]);

      const result = await service.getExchangesByStatus();

      expect(result.exchanges).toHaveLength(2);
    });

    it('status로 필터링한다', async () => {
      repository.setExchanges([
        createExchange({ id: 'ex-1', status: 'pending' }),
        createExchange({ id: 'ex-2', status: 'completed' }),
        createExchange({ id: 'ex-3', status: 'pending' }),
      ]);

      const result = await service.getExchangesByStatus('pending');

      expect(result.exchanges).toHaveLength(2);
      expect(result.exchanges.every((e) => e.status === 'pending')).toBe(true);
    });

    it('해당 status가 없으면 빈 배열을 반환한다', async () => {
      repository.setExchanges([
        createExchange({ id: 'ex-1', status: 'completed' }),
      ]);

      const result = await service.getExchangesByStatus('pending');

      expect(result.exchanges).toEqual([]);
    });
  });

  describe('approveExchange', () => {
    beforeEach(() => {
      repository.setAccounts([
        createAccount({ id: 'acc-1', user_id: userId, status: 'connected' }),
      ]);
    });

    it('pending 상태의 요청을 승인하고 다우 API 호출 성공 시 completed', async () => {
      repository.setExchanges([
        createExchange({
          id: 'ex-1',
          user_id: userId,
          status: 'pending',
          naverpay_point: 5050,
        }),
      ]);
      daouClient.setEarnSuccess('daou-tx-001');

      const result = await service.approveExchange('ex-1');

      expect(result).toEqual({
        success: true,
        status: 'completed',
        txNo: 'daou-tx-001',
      });

      const exchange = await repository.findExchangeById('ex-1');
      expect(exchange?.status).toBe('completed');
      expect(exchange?.partner_tx_no).not.toBeNull();
      expect(exchange?.tx_no).toBe('daou-tx-001');
    });

    it('다우 API 호출 실패 시 포인트 복원하고 failed', async () => {
      repository.setExchanges([
        createExchange({
          id: 'ex-1',
          user_id: userId,
          status: 'pending',
          cashmore_point: 5000,
          point_action_id: 42,
        }),
      ]);
      daouClient.setEarnFailure('41019', '월 적립 한도 초과');

      const result = await service.approveExchange('ex-1');

      expect(result.success).toBe(false);
      expect(result.status).toBe('failed');
      expect(result.errorCode).toBe('41019');

      const exchange = await repository.findExchangeById('ex-1');
      expect(exchange?.status).toBe('failed');
      expect(exchange?.error_code).toBe('41019');

      // 포인트 복원 확인
      const restorations = pointService.getRestorations();
      expect(restorations).toHaveLength(1);
      expect(restorations[0].amount).toBe(5000);
    });

    it('유저의 네이버페이 계정이 없으면 BadRequestException', async () => {
      repository.clear();
      repository.setExchanges([
        createExchange({ id: 'ex-1', user_id: userId, status: 'pending' }),
      ]);

      await expect(service.approveExchange('ex-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('존재하지 않는 요청이면 NotFoundException', async () => {
      await expect(service.approveExchange('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('pending이 아닌 요청은 승인할 수 없다', async () => {
      repository.setExchanges([
        createExchange({ id: 'ex-1', status: 'completed' }),
      ]);

      await expect(service.approveExchange('ex-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('다우 API가 예외를 throw하면 포인트 복원하고 failed 처리한다', async () => {
      repository.setExchanges([
        createExchange({
          id: 'ex-1',
          user_id: userId,
          status: 'pending',
          cashmore_point: 5000,
          point_action_id: 42,
        }),
      ]);
      daouClient.setEarnThrow(new Error('ECONNREFUSED'));

      const result = await service.approveExchange('ex-1');

      expect(result.success).toBe(false);
      expect(result.status).toBe('failed');
      expect(result.errorCode).toBe('NETWORK_ERROR');

      // 상태가 failed로 변경되었는지 확인
      const exchange = await repository.findExchangeById('ex-1');
      expect(exchange?.status).toBe('failed');
      expect(exchange?.error_code).toBe('NETWORK_ERROR');

      // 포인트 복원 확인
      const restorations = pointService.getRestorations();
      expect(restorations).toHaveLength(1);
      expect(restorations[0].amount).toBe(5000);
      expect(restorations[0].originalPointActionId).toBe(42);
    });

    it('다우 API가 예외를 throw해도 point_action_id가 없으면 복원 없이 failed 처리한다', async () => {
      repository.setExchanges([
        createExchange({
          id: 'ex-1',
          user_id: userId,
          status: 'pending',
          cashmore_point: 5000,
          point_action_id: null,
        }),
      ]);
      daouClient.setEarnThrow(new Error('timeout'));

      const result = await service.approveExchange('ex-1');

      expect(result.success).toBe(false);
      expect(result.status).toBe('failed');

      // 포인트 복원 호출 없음
      const restorations = pointService.getRestorations();
      expect(restorations).toHaveLength(0);

      // 상태는 failed
      const exchange = await repository.findExchangeById('ex-1');
      expect(exchange?.status).toBe('failed');
    });
  });

  describe('rejectExchange', () => {
    it('pending 상태의 요청을 거절하고 포인트를 복원한다', async () => {
      repository.setExchanges([
        createExchange({
          id: 'ex-1',
          user_id: userId,
          status: 'pending',
          cashmore_point: 5000,
          point_action_id: 42,
        }),
      ]);

      const result = await service.rejectExchange('ex-1');

      expect(result).toEqual({ success: true });

      // 상태 변경 확인
      const exchange = await repository.findExchangeById('ex-1');
      expect(exchange?.status).toBe('rejected');
      expect(exchange?.processed_at).not.toBeNull();

      // 포인트 복원 확인
      const restorations = pointService.getRestorations();
      expect(restorations).toHaveLength(1);
      expect(restorations[0].amount).toBe(5000);
      expect(restorations[0].originalPointActionId).toBe(42);
    });

    it('존재하지 않는 요청이면 NotFoundException', async () => {
      await expect(service.rejectExchange('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('pending이 아닌 요청은 거절할 수 없다', async () => {
      repository.setExchanges([
        createExchange({ id: 'ex-1', status: 'approved' }),
      ]);

      await expect(service.rejectExchange('ex-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getExchangeConfig', () => {
    it('전환 정책과 오늘 사용 횟수를 반환한다', async () => {
      const result = await service.getExchangeConfig(userId);

      expect(result).toEqual({
        exchangeRate: 1.01,
        minPoint: 1000,
        dailyLimit: 1,
        todayUsed: 0,
      });
    });

    it('오늘 전환 요청이 있으면 todayUsed에 반영한다', async () => {
      repository.setExchanges([
        createExchange({
          user_id: userId,
          created_at: new Date().toISOString(),
        }),
      ]);

      const result = await service.getExchangeConfig(userId);

      expect(result.todayUsed).toBe(1);
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

function createExchange(
  overrides: Partial<NaverPayExchange> = {},
): NaverPayExchange {
  return {
    id: 'exchange-1',
    user_id: 'test-user-id',
    naver_pay_account_id: 'account-1',
    cashmore_point: 5000,
    naverpay_point: 5000,
    exchange_rate: 1,
    status: 'pending',
    point_action_id: null,
    partner_tx_no: null,
    tx_no: null,
    error_code: null,
    created_at: '2026-03-16T12:00:00Z',
    processed_at: null,
    ...overrides,
  };
}
