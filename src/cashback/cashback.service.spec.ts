import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { CashbackService } from './cashback.service';
import { CASHBACK_REPOSITORY } from './interfaces/cashback-repository.interface';
import { StubCashbackRepository } from './repositories/stub-cashback.repository';
import { SlackService } from '../slack/slack.service';

describe('CashbackService', () => {
  let service: CashbackService;
  let repository: StubCashbackRepository;
  let slackSpy: ReturnType<typeof vi.fn>;
  const userId = 'test-user-id';

  beforeEach(async () => {
    repository = new StubCashbackRepository();
    slackSpy = vi.fn().mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CashbackService,
        {
          provide: CASHBACK_REPOSITORY,
          useValue: repository,
        },
        {
          provide: SlackService,
          useValue: { reportBugToSlack: slackSpy },
        },
      ],
    }).compile();

    service = module.get<CashbackService>(CashbackService);
  });

  describe('getReceivedCashback', () => {
    beforeEach(() => {
      repository.clear();
    });

    it('데이터가 없으면 0을 반환한다', async () => {
      const result = await service.getReceivedCashback(userId);

      expect(result.receivedCashback).toBe(0);
    });

    it('completed claim의 cashback_amount를 합산한다', async () => {
      repository.setClaims(userId, [
        {
          id: 1,
          created_at: '2026-03-24T10:00:00Z',
          cashback_amount: 500,
          status: 'completed',
          location_info: null,
        },
        {
          id: 2,
          created_at: '2026-03-24T09:00:00Z',
          cashback_amount: 300,
          status: 'completed',
          location_info: null,
        },
      ]);

      const result = await service.getReceivedCashback(userId);

      expect(result.receivedCashback).toBe(800);
    });

    it('completed가 아닌 claim은 합산에서 제외한다', async () => {
      repository.setClaims(userId, [
        {
          id: 1,
          created_at: '2026-03-24T10:00:00Z',
          cashback_amount: 500,
          status: 'completed',
          location_info: null,
        },
        {
          id: 2,
          created_at: '2026-03-24T09:00:00Z',
          cashback_amount: 300,
          status: 'processing',
          location_info: null,
        },
        {
          id: 3,
          created_at: '2026-03-24T08:00:00Z',
          cashback_amount: 200,
          status: 'rejected',
          location_info: null,
        },
      ]);

      const result = await service.getReceivedCashback(userId);

      expect(result.receivedCashback).toBe(500);
    });

    it('EXCHANGE_POINT_TO_CASH의 done 상태 point_amount를 음수 반전하여 합산한다', async () => {
      repository.setPointActions(userId, [
        {
          id: 10,
          created_at: '2026-03-24T10:00:00Z',
          point_amount: -5000,
          type: 'EXCHANGE_POINT_TO_CASH',
          status: 'done',
          additional_data: null,
        },
        {
          id: 11,
          created_at: '2026-03-24T09:00:00Z',
          point_amount: -3000,
          type: 'EXCHANGE_POINT_TO_CASH',
          status: 'done',
          additional_data: null,
        },
      ]);

      const result = await service.getReceivedCashback(userId);

      expect(result.receivedCashback).toBe(8000);
    });

    it('done이 아닌 EXCHANGE_POINT_TO_CASH는 합산에서 제외한다', async () => {
      repository.setPointActions(userId, [
        {
          id: 10,
          created_at: '2026-03-24T10:00:00Z',
          point_amount: -5000,
          type: 'EXCHANGE_POINT_TO_CASH',
          status: 'done',
          additional_data: null,
        },
        {
          id: 11,
          created_at: '2026-03-24T09:00:00Z',
          point_amount: -3000,
          type: 'EXCHANGE_POINT_TO_CASH',
          status: 'pending',
          additional_data: null,
        },
      ]);

      const result = await service.getReceivedCashback(userId);

      expect(result.receivedCashback).toBe(5000);
    });

    it('claim 캐시백과 환급 포인트를 합산한다', async () => {
      repository.setClaims(userId, [
        {
          id: 1,
          created_at: '2026-03-24T10:00:00Z',
          cashback_amount: 1000,
          status: 'completed',
          location_info: null,
        },
      ]);
      repository.setPointActions(userId, [
        {
          id: 10,
          created_at: '2026-03-24T09:00:00Z',
          point_amount: -2000,
          type: 'EXCHANGE_POINT_TO_CASH',
          status: 'done',
          additional_data: null,
        },
      ]);

      const result = await service.getReceivedCashback(userId);

      expect(result.receivedCashback).toBe(3000);
    });

    it('cashback_amount가 null인 claim은 0으로 처리한다', async () => {
      repository.setClaims(userId, [
        {
          id: 1,
          created_at: '2026-03-24T10:00:00Z',
          cashback_amount: null,
          status: 'completed',
          location_info: null,
        },
      ]);

      const result = await service.getReceivedCashback(userId);

      expect(result.receivedCashback).toBe(0);
    });
  });

  describe('getCashbackList', () => {
    beforeEach(() => {
      repository.clear();
    });

    it('데이터가 없으면 빈 배열과 null 커서를 반환한다', async () => {
      const result = await service.getCashbackList(userId, null, 20);

      expect(result.items).toEqual([]);
      expect(result.nextCursor).toBeNull();
    });

    it('everyReceipt 데이터를 올바르게 변환한다', async () => {
      repository.setEveryReceipts(userId, [
        {
          id: 1,
          created_at: '2026-03-24T10:00:00Z',
          point: 100,
          status: 'done',
          image_url: 'https://example.com/image.jpg',
        },
      ]);

      const result = await service.getCashbackList(userId, null, 20);

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toEqual({
        id: 'everyReceipt-1',
        type: 'everyReceipt',
        createdAt: '2026-03-24T10:00:00Z',
        amount: 100,
        status: 'done',
        data: { imageUrl: 'https://example.com/image.jpg' },
      });
    });

    it('everyReceipt의 point가 null이면 0으로 처리한다', async () => {
      repository.setEveryReceipts(userId, [
        {
          id: 1,
          created_at: '2026-03-24T10:00:00Z',
          point: null,
          status: null,
          image_url: null,
        },
      ]);

      const result = await service.getCashbackList(userId, null, 20);

      expect(result.items[0].amount).toBe(0);
    });

    it('pointActions 데이터를 타입에 맞게 변환한다', async () => {
      repository.setPointActions(userId, [
        {
          id: 10,
          created_at: '2026-03-24T09:00:00Z',
          point_amount: -5000,
          type: 'EXCHANGE_POINT_TO_CASH',
          status: 'done',
          additional_data: null,
        },
        {
          id: 11,
          created_at: '2026-03-24T08:00:00Z',
          point_amount: 200,
          type: 'INVITE_REWARD',
          status: 'done',
          additional_data: { some: 'data' },
        },
      ]);

      const result = await service.getCashbackList(userId, null, 20);

      expect(result.items).toHaveLength(2);
      expect(result.items[0]).toEqual({
        id: 'pointAction-10',
        type: 'exchangePointToCash',
        createdAt: '2026-03-24T09:00:00Z',
        amount: -5000,
        status: 'done',
        data: null,
      });
      expect(result.items[1]).toEqual({
        id: 'pointAction-11',
        type: 'invitationReward',
        createdAt: '2026-03-24T08:00:00Z',
        amount: 200,
        status: 'done',
        data: { some: 'data' },
      });
    });

    it('INVITED_USER_REWARD도 invitationReward로 매핑한다', async () => {
      repository.setPointActions(userId, [
        {
          id: 20,
          created_at: '2026-03-24T10:00:00Z',
          point_amount: 100,
          type: 'INVITED_USER_REWARD',
          status: 'done',
          additional_data: null,
        },
      ]);

      const result = await service.getCashbackList(userId, null, 20);

      expect(result.items[0].type).toBe('invitationReward');
    });

    it('모든 point_action 타입이 올바르게 매핑된다', async () => {
      const typeMappings: [string, string][] = [
        ['EXCHANGE_POINT_TO_CASH', 'exchangePointToCash'],
        ['INVITE_5_REWARD', 'invitedUserMissionReward_5'],
        ['INVITE_2_REWARD', 'invitedUserMissionReward_2'],
        ['INVITE_STEP_REWARD', 'inviteStepReward'],
        ['INVITED_USER_REWARD_RANDOM', 'invitationRewardRandom'],
        ['COUPANG_VISIT', 'coupangVisit'],
        ['ONBOARDING_EVENT', 'onboardingEvent'],
        ['LOTTERY', 'lottery'],
        ['WEEKLY_ATTENDANCE_BONUS', 'attendanceWeeklyBonus'],
        ['POINT_EXPIRATION', 'pointExpiration'],
        ['DIVIDEND', 'dividend'],
        ['BUZZVIL_REWARD', 'buzzvilReward'],
        ['INVITATION_RECEIPT', 'invitationReceipt'],
      ];

      for (const [dbType, expectedType] of typeMappings) {
        repository.clear();
        repository.setPointActions(userId, [
          {
            id: 1,
            created_at: '2026-03-24T10:00:00Z',
            point_amount: 100,
            type: dbType,
            status: 'done',
            additional_data: null,
          },
        ]);

        const result = await service.getCashbackList(userId, null, 20);
        expect(result.items[0].type).toBe(expectedType);
      }
    });

    it('stepRewards 데이터를 올바르게 변환한다', async () => {
      repository.setStepRewards(userId, [
        {
          id: 5,
          created_at: '2026-03-24T07:00:00Z',
          point_amount: 30,
          step_count: 5000,
        },
      ]);

      const result = await service.getCashbackList(userId, null, 20);

      expect(result.items[0]).toEqual({
        id: 'stepReward-5',
        type: 'stepReward',
        createdAt: '2026-03-24T07:00:00Z',
        amount: 30,
        data: { stepCount: 5000 },
      });
    });

    it('affiliateData의 completed 상태에서는 approval_date를 createdAt으로 사용한다', async () => {
      repository.setAffiliateData(userId, [
        {
          id: 7,
          created_at: '2026-03-20T10:00:00Z',
          point_amount: 500,
          status: 'completed',
          approval_date: '2026-03-24T10:00:00Z',
          instant_amount: 100,
          prepayment_metadata: null,
          data: { merchant_id: 'shop1', product_name: 'Test Product' },
        },
      ]);

      const result = await service.getCashbackList(userId, null, 20);

      expect(result.items[0]).toEqual({
        id: 'affiliate-7-2026-03-20T10:00:00Z',
        type: 'affiliateCashback',
        createdAt: '2026-03-24T10:00:00Z',
        amount: 500,
        status: 'completed',
        data: {
          approvalDate: '2026-03-24T10:00:00Z',
          instantAmount: 100,
          prepaymentMetadata: null,
          merchantId: 'shop1',
          productName: 'Test Product',
        },
      });
    });

    it('affiliateData의 pending 상태에서는 created_at을 createdAt으로 사용한다', async () => {
      repository.setAffiliateData(userId, [
        {
          id: 8,
          created_at: '2026-03-20T10:00:00Z',
          point_amount: 300,
          status: 'pending',
          approval_date: null,
          instant_amount: 50,
          prepayment_metadata: null,
          data: null,
        },
      ]);

      const result = await service.getCashbackList(userId, null, 20);

      expect(result.items[0].createdAt).toBe('2026-03-20T10:00:00Z');
    });

    it('attendance 데이터를 point_actions와 매칭하여 포인트를 가져온다', async () => {
      repository.setAttendances(userId, [
        {
          id: 100,
          created_at: '2026-03-24T08:00:00Z',
          created_at_date: '2026-03-24',
        },
      ]);
      repository.setAttendancePointActions(userId, [
        {
          id: 200,
          point_amount: 10,
          additional_data: { attendance_id: 100 },
          type: 'ATTENDANCE',
        },
      ]);

      const result = await service.getCashbackList(userId, null, 20);

      expect(result.items[0]).toEqual({
        id: 'attendance-100',
        type: 'attendance',
        createdAt: '2026-03-24T08:00:00Z',
        amount: 10,
        data: { attendanceDate: '2026-03-24' },
      });
    });

    it('attendance에 매칭되는 point_action이 없으면 amount는 0이다', async () => {
      repository.setAttendances(userId, [
        {
          id: 101,
          created_at: '2026-03-24T08:00:00Z',
          created_at_date: '2026-03-24',
        },
      ]);
      repository.setAttendancePointActions(userId, []);

      const result = await service.getCashbackList(userId, null, 20);

      expect(result.items[0].amount).toBe(0);
    });

    it('claim 데이터에서 location_info.title이 있는 것만 포함한다', async () => {
      repository.setClaims(userId, [
        {
          id: 50,
          created_at: '2026-03-24T06:00:00Z',
          cashback_amount: 200,
          status: 'completed',
          location_info: { title: 'Test Store' },
        },
        {
          id: 51,
          created_at: '2026-03-24T05:00:00Z',
          cashback_amount: 100,
          status: 'completed',
          location_info: null,
        },
      ]);

      const result = await service.getCashbackList(userId, null, 20);

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toEqual({
        id: 'claim-50',
        type: 'claim',
        createdAt: '2026-03-24T06:00:00Z',
        amount: 200,
        status: 'completed',
        data: { title: 'Test Store' },
      });
    });

    it('여러 테이블 데이터를 created_at 내림차순으로 정렬한다', async () => {
      repository.setEveryReceipts(userId, [
        {
          id: 1,
          created_at: '2026-03-24T10:00:00Z',
          point: 100,
          status: 'done',
          image_url: null,
        },
      ]);
      repository.setStepRewards(userId, [
        {
          id: 2,
          created_at: '2026-03-24T12:00:00Z',
          point_amount: 30,
          step_count: 3000,
        },
      ]);
      repository.setPointActions(userId, [
        {
          id: 3,
          created_at: '2026-03-24T08:00:00Z',
          point_amount: 200,
          type: 'LOTTERY',
          status: 'done',
          additional_data: null,
        },
      ]);

      const result = await service.getCashbackList(userId, null, 20);

      expect(result.items).toHaveLength(3);
      expect(result.items[0].createdAt).toBe('2026-03-24T12:00:00Z'); // stepReward
      expect(result.items[1].createdAt).toBe('2026-03-24T10:00:00Z'); // everyReceipt
      expect(result.items[2].createdAt).toBe('2026-03-24T08:00:00Z'); // lottery
    });

    it('여러 소스에서 limit 초과 데이터가 합쳐지면 nextCursor를 설정한다', async () => {
      // 각 소스에서 limit(2)개씩 가져와 합치면 총 4개 → limit 초과
      repository.setEveryReceipts(userId, [
        {
          id: 1,
          created_at: '2026-03-24T10:00:00Z',
          point: 100,
          status: 'done',
          image_url: null,
        },
        {
          id: 2,
          created_at: '2026-03-24T08:00:00Z',
          point: 50,
          status: 'done',
          image_url: null,
        },
      ]);
      repository.setStepRewards(userId, [
        {
          id: 3,
          created_at: '2026-03-24T09:00:00Z',
          point_amount: 30,
          step_count: 3000,
        },
        {
          id: 4,
          created_at: '2026-03-24T07:00:00Z',
          point_amount: 20,
          step_count: 5000,
        },
      ]);

      const result = await service.getCashbackList(userId, null, 2);

      expect(result.items).toHaveLength(2);
      expect(result.nextCursor).toBe('2026-03-24T09:00:00Z');
    });

    it('데이터가 limit 이하면 nextCursor는 null이다', async () => {
      repository.setEveryReceipts(userId, [
        {
          id: 1,
          created_at: '2026-03-24T10:00:00Z',
          point: 100,
          status: 'done',
          image_url: null,
        },
      ]);

      const result = await service.getCashbackList(userId, null, 20);

      expect(result.nextCursor).toBeNull();
    });

    it('cursor를 전달하면 해당 시간 이전 데이터만 반환한다', async () => {
      repository.setEveryReceipts(userId, [
        {
          id: 1,
          created_at: '2026-03-24T10:00:00Z',
          point: 100,
          status: 'done',
          image_url: null,
        },
        {
          id: 2,
          created_at: '2026-03-24T09:00:00Z',
          point: 50,
          status: 'done',
          image_url: null,
        },
        {
          id: 3,
          created_at: '2026-03-24T08:00:00Z',
          point: 30,
          status: 'done',
          image_url: null,
        },
      ]);

      const result = await service.getCashbackList(
        userId,
        '2026-03-24T10:00:00Z',
        20,
      );

      expect(result.items).toHaveLength(2);
      expect(result.items[0].createdAt).toBe('2026-03-24T09:00:00Z');
      expect(result.items[1].createdAt).toBe('2026-03-24T08:00:00Z');
    });

    it('7개 소스 데이터를 모두 합쳐서 정렬한다', async () => {
      repository.setEveryReceipts(userId, [
        {
          id: 1,
          created_at: '2026-03-24T13:00:00Z',
          point: 100,
          status: 'done',
          image_url: null,
        },
      ]);
      repository.setPointActions(userId, [
        {
          id: 2,
          created_at: '2026-03-24T12:00:00Z',
          point_amount: 200,
          type: 'LOTTERY',
          status: 'done',
          additional_data: null,
        },
      ]);
      repository.setStepRewards(userId, [
        {
          id: 3,
          created_at: '2026-03-24T11:00:00Z',
          point_amount: 30,
          step_count: 3000,
        },
      ]);
      repository.setAffiliateData(userId, [
        {
          id: 4,
          created_at: '2026-03-24T10:00:00Z',
          point_amount: 500,
          status: 'pending',
          approval_date: null,
          instant_amount: 100,
          prepayment_metadata: null,
          data: null,
        },
      ]);
      repository.setAttendances(userId, [
        {
          id: 5,
          created_at: '2026-03-24T09:00:00Z',
          created_at_date: '2026-03-24',
        },
      ]);
      repository.setAttendancePointActions(userId, [
        {
          id: 50,
          point_amount: 10,
          additional_data: { attendance_id: 5 },
          type: 'ATTENDANCE',
        },
      ]);
      repository.setNaverPayExchanges(userId, [
        {
          id: 'npe-1',
          created_at: '2026-03-24T08:00:00Z',
          cashmore_point: 5000,
          naverpay_point: 4500,
          status: 'completed',
        },
      ]);
      repository.setClaims(userId, [
        {
          id: 6,
          created_at: '2026-03-24T07:00:00Z',
          cashback_amount: 200,
          status: 'completed',
          location_info: { title: 'Test Store' },
        },
      ]);

      const result = await service.getCashbackList(userId, null, 20);

      expect(result.items).toHaveLength(7);
      expect(result.items.map((i) => i.type)).toEqual([
        'everyReceipt',
        'lottery',
        'stepReward',
        'affiliateCashback',
        'attendance',
        'exchangePointToNaverpay',
        'claim',
      ]);
    });

    it('naverPayExchange 데이터를 올바르게 변환한다', async () => {
      repository.setNaverPayExchanges(userId, [
        {
          id: 'npe-uuid-1',
          created_at: '2026-03-24T10:00:00Z',
          cashmore_point: 5000,
          naverpay_point: 4500,
          status: 'completed',
        },
      ]);

      const result = await service.getCashbackList(userId, null, 20);

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toEqual({
        id: 'naverPayExchange-npe-uuid-1',
        type: 'exchangePointToNaverpay',
        createdAt: '2026-03-24T10:00:00Z',
        amount: -5000,
        status: 'completed',
        data: { naverpayPoint: 4500 },
      });
    });

    it('naverPayExchange amount는 cashmore_point의 음수이다', async () => {
      repository.setNaverPayExchanges(userId, [
        {
          id: 'npe-2',
          created_at: '2026-03-24T10:00:00Z',
          cashmore_point: 3000,
          naverpay_point: 2700,
          status: 'completed',
        },
      ]);

      const result = await service.getCashbackList(userId, null, 20);

      expect(result.items[0].amount).toBe(-3000);
    });

    it('여러 소스에서 20개 초과 데이터가 합쳐지면 20개만 반환하고 nextCursor를 설정한다', async () => {
      // everyReceipt 11개 + stepRewards 11개 = 22개 → 20개만 반환
      const receipts = Array.from({ length: 11 }, (_, i) => ({
        id: i + 1,
        created_at: `2026-03-${String(24 - i).padStart(2, '0')}T12:00:00Z`,
        point: 10,
        status: 'done' as const,
        image_url: null,
      }));
      const stepRewards = Array.from({ length: 11 }, (_, i) => ({
        id: i + 100,
        created_at: `2026-03-${String(24 - i).padStart(2, '0')}T06:00:00Z`,
        point_amount: 5,
        step_count: 3000,
      }));
      repository.setEveryReceipts(userId, receipts);
      repository.setStepRewards(userId, stepRewards);

      const result = await service.getCashbackList(userId, null, 20);

      expect(result.items).toHaveLength(20);
      expect(result.nextCursor).not.toBeNull();
    });
  });

  describe('cash_exchanges 마이그레이션 비교 로직', () => {
    beforeEach(() => {
      repository.clear();
      slackSpy.mockClear();
    });

    it('sumExchangePointToCash와 sumCashExchangeDone이 일치하면 슬랙 알림이 없다', async () => {
      repository.setPointActions(userId, [
        {
          id: 1,
          created_at: '2026-03-24T10:00:00Z',
          point_amount: -5000,
          type: 'EXCHANGE_POINT_TO_CASH',
          status: 'done',
          additional_data: null,
        },
      ]);
      repository.setCashExchanges(userId, [
        {
          id: 100,
          point_action_id: 1,
          created_at: '2026-03-24T10:00:00Z',
          amount: 5000,
          status: 'done',
        },
      ]);

      const result = await service.getReceivedCashback(userId);

      expect(result.receivedCashback).toBe(5000);
      expect(slackSpy).not.toHaveBeenCalled();
    });

    it('sumExchangePointToCash와 sumCashExchangeDone이 다르면 슬랙 알림이 발송된다', async () => {
      repository.setPointActions(userId, [
        {
          id: 1,
          created_at: '2026-03-24T10:00:00Z',
          point_amount: -5000,
          type: 'EXCHANGE_POINT_TO_CASH',
          status: 'done',
          additional_data: null,
        },
      ]);
      // cash_exchanges에는 다른 금액
      repository.setCashExchanges(userId, [
        {
          id: 100,
          point_action_id: 1,
          created_at: '2026-03-24T10:00:00Z',
          amount: 4000,
          status: 'done',
        },
      ]);

      const result = await service.getReceivedCashback(userId);

      // 응답은 legacy 기준
      expect(result.receivedCashback).toBe(5000);
      // 슬랙 알림 호출 확인
      expect(slackSpy).toHaveBeenCalledTimes(1);
      expect(slackSpy.mock.calls[0][0]).toContain('sumExchangePointToCash mismatch');
    });

    it('cashbackList에서 cash_exchanges와 일치하면 슬랙 알림이 없다', async () => {
      repository.setPointActions(userId, [
        {
          id: 1,
          created_at: '2026-03-24T10:00:00Z',
          point_amount: -5000,
          type: 'EXCHANGE_POINT_TO_CASH',
          status: 'done',
          additional_data: null,
        },
      ]);
      repository.setCashExchanges(userId, [
        {
          id: 100,
          point_action_id: 1,
          created_at: '2026-03-24T10:00:00Z',
          amount: 5000,
          status: 'done',
        },
      ]);

      await service.getCashbackList(userId, null, 20);

      expect(slackSpy).not.toHaveBeenCalled();
    });

    it('cashbackList에서 cash_exchanges 건수가 다르면 슬랙 알림이 발송된다', async () => {
      repository.setPointActions(userId, [
        {
          id: 1,
          created_at: '2026-03-24T10:00:00Z',
          point_amount: -5000,
          type: 'EXCHANGE_POINT_TO_CASH',
          status: 'done',
          additional_data: null,
        },
      ]);
      // cash_exchanges에는 행 없음
      repository.setCashExchanges(userId, []);

      await service.getCashbackList(userId, null, 20);

      expect(slackSpy).toHaveBeenCalledTimes(1);
      expect(slackSpy.mock.calls[0][0]).toContain('cashbackList count mismatch');
    });

    it('cashbackList에서 status가 다르면 슬랙 알림이 발송된다', async () => {
      repository.setPointActions(userId, [
        {
          id: 1,
          created_at: '2026-03-24T10:00:00Z',
          point_amount: -5000,
          type: 'EXCHANGE_POINT_TO_CASH',
          status: 'done',
          additional_data: null,
        },
      ]);
      repository.setCashExchanges(userId, [
        {
          id: 100,
          point_action_id: 1,
          created_at: '2026-03-24T10:00:00Z',
          amount: 5000,
          status: 'pending',
        },
      ]);

      await service.getCashbackList(userId, null, 20);

      expect(slackSpy).toHaveBeenCalledTimes(1);
      expect(slackSpy.mock.calls[0][0]).toContain('cashbackList mismatch');
    });
  });
});
