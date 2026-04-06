import { describe, it, expect, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ExchangePointService } from './exchange-point.service';
import { EXCHANGE_POINT_REPOSITORY } from './interfaces/exchange-point-repository.interface';
import { StubExchangePointRepository } from './repositories/stub-exchange-point.repository';
import { CASH_EXCHANGE_REPOSITORY } from './interfaces/cash-exchange-repository.interface';
import { StubCashExchangeRepository } from './repositories/stub-cash-exchange.repository';
import { USER_MODAL_REPOSITORY } from '../user-modal/interfaces/user-modal-repository.interface';
import { StubUserModalRepository } from '../user-modal/repositories/stub-user-modal.repository';
import { FcmService } from '../fcm/fcm.service';
import { USER_REPOSITORY } from '../user/interfaces/user-repository.interface';
import { StubUserRepository } from '../user/repositories/stub-user.repository';
import { AccountInfoService } from '../account-info/account-info.service';

const stubFcmService = {
  pushNotification: async () => {},
  sendRefreshMessage: async () => {},
};

const stubAccountInfoService = {
  getBulkAccountInfo: async () => [],
  getBulkAccountInfoName: async () => [],
};

describe('ExchangePointService', () => {
  let service: ExchangePointService;
  let repository: StubExchangePointRepository;
  let cashExchangeRepository: StubCashExchangeRepository;
  let userRepository: StubUserRepository;
  const userId = 'test-user-id';

  beforeEach(async () => {
    repository = new StubExchangePointRepository();
    cashExchangeRepository = new StubCashExchangeRepository();
    userRepository = new StubUserRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExchangePointService,
        {
          provide: EXCHANGE_POINT_REPOSITORY,
          useValue: repository,
        },
        {
          provide: CASH_EXCHANGE_REPOSITORY,
          useValue: cashExchangeRepository,
        },
        {
          provide: USER_MODAL_REPOSITORY,
          useClass: StubUserModalRepository,
        },
        {
          provide: USER_REPOSITORY,
          useValue: userRepository,
        },
        {
          provide: AccountInfoService,
          useValue: stubAccountInfoService,
        },
        {
          provide: FcmService,
          useValue: stubFcmService,
        },
      ],
    }).compile();

    service = module.get<ExchangePointService>(ExchangePointService);
  });

  describe('getExchangeHistory', () => {
    it('출금 내역을 반환한다', async () => {
      repository.setExchanges(userId, [
        {
          id: 1,
          user_id: userId,
          type: 'EXCHANGE_POINT_TO_CASH',
          point_amount: -5000,
          status: 'pending',
          created_at: '2025-01-01T00:00:00Z',
          additional_data: null,
        },
      ]);

      const result = await service.getExchangeHistory(userId);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 1,
        createdAt: '2025-01-01T00:00:00Z',
        amount: -5000,
        status: 'pending',
      });
    });

    it('내역이 없으면 빈 배열을 반환한다', async () => {
      const result = await service.getExchangeHistory(userId);
      expect(result).toEqual([]);
    });
  });

  describe('getPendingWithAccountInfo', () => {
    const makeUser = (
      id: string,
      email: string,
      isBanned: boolean = false,
    ) => ({
      id,
      email,
      auth_id: `auth-${id}`,
      created_at: '2025-01-01T00:00:00Z',
      marketing_info: false,
      is_banned: isBanned,
      nickname: null,
      provider: 'kakao' as const,
    });

    it('pending 건이 없으면 빈 배열을 반환한다', async () => {
      const result = await service.getPendingWithAccountInfo();

      expect(result.exchangePoints).toEqual([]);
      expect(result.pendingAccountInfo).toEqual([]);
      expect(result.accountInfoName).toEqual([]);
    });

    it('pending 건이 있으면 유저 정보와 함께 반환한다', async () => {
      userRepository.setUser(makeUser('user-1', 'user1@test.com'));
      await cashExchangeRepository.insert({
        user_id: 'user-1',
        amount: 5000,
        point_action_id: 100,
      });

      const result = await service.getPendingWithAccountInfo();

      expect(result.exchangePoints).toHaveLength(1);
      expect(result.exchangePoints[0]).toMatchObject({
        id: 100, // point_action_id
        userId: 'user-1',
        status: 'pending',
        amount: 5000,
        email: 'user1@test.com',
      });
    });

    it('차단된 유저의 출금은 제외한다', async () => {
      userRepository.setUser(makeUser('user-1', 'user1@test.com', false));
      userRepository.setUser(makeUser('banned-1', 'banned@test.com', true));

      await cashExchangeRepository.insert({
        user_id: 'user-1',
        amount: 5000,
        point_action_id: 100,
      });
      await cashExchangeRepository.insert({
        user_id: 'banned-1',
        amount: 3000,
        point_action_id: 101,
      });

      const result = await service.getPendingWithAccountInfo();

      expect(result.exchangePoints).toHaveLength(1);
      expect(result.exchangePoints[0].userId).toBe('user-1');
    });

    it('pending이 아닌 건은 포함되지 않는다', async () => {
      userRepository.setUser(makeUser('user-1', 'user1@test.com'));

      await cashExchangeRepository.insert({
        user_id: 'user-1',
        amount: 5000,
        point_action_id: 100,
      });
      await cashExchangeRepository.updateStatus(100, 'done', {
        confirmed_at: new Date().toISOString(),
      });

      const result = await service.getPendingWithAccountInfo();

      expect(result.exchangePoints).toEqual([]);
    });

    it('user 정보가 없는 건은 제외한다', async () => {
      // 유저 등록 안 함
      await cashExchangeRepository.insert({
        user_id: 'ghost-user',
        amount: 5000,
        point_action_id: 100,
      });

      const result = await service.getPendingWithAccountInfo();

      expect(result.exchangePoints).toEqual([]);
    });

    it('반환되는 id는 cash_exchanges.id가 아니라 point_action_id다', async () => {
      userRepository.setUser(makeUser('user-1', 'user1@test.com'));

      await cashExchangeRepository.insert({
        user_id: 'user-1',
        amount: 5000,
        point_action_id: 99999,
      });

      const result = await service.getPendingWithAccountInfo();

      expect(result.exchangePoints[0].id).toBe(99999);
    });
  });

  describe('requestExchange', () => {
    it('출금 신청에 성공한다', async () => {
      repository.setTotalPoints(userId, 10000);

      const result = await service.requestExchange(userId, 5000);

      expect(result).toEqual({ success: true, id: 1 });
    });

    it('금액이 1000 미만이면 BadRequestException', async () => {
      repository.setTotalPoints(userId, 10000);

      await expect(service.requestExchange(userId, 500)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('금액이 0이면 BadRequestException', async () => {
      repository.setTotalPoints(userId, 10000);

      await expect(service.requestExchange(userId, 0)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('잔액이 부족하면 BadRequestException', async () => {
      repository.setTotalPoints(userId, 3000);

      await expect(service.requestExchange(userId, 5000)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('잔액과 동일한 금액은 출금 가능하다', async () => {
      repository.setTotalPoints(userId, 5000);

      const result = await service.requestExchange(userId, 5000);

      expect(result).toEqual({ success: true, id: 1 });
    });

    it('출금 신청 시 cash_exchanges에도 기록된다', async () => {
      repository.setTotalPoints(userId, 10000);

      await service.requestExchange(userId, 5000);

      const cashExchanges = cashExchangeRepository.getAll();
      expect(cashExchanges).toHaveLength(1);
      expect(cashExchanges[0]).toMatchObject({
        user_id: userId,
        amount: 5000,
        status: 'pending',
        point_action_id: 1,
      });
    });
  });

  describe('cancelExchange', () => {
    it('pending 상태 출금을 취소한다', async () => {
      repository.setExchanges(userId, [
        {
          id: 1,
          user_id: userId,
          type: 'EXCHANGE_POINT_TO_CASH',
          point_amount: -5000,
          status: 'pending',
          created_at: '2025-01-01T00:00:00Z',
          additional_data: null,
        },
      ]);

      const result = await service.cancelExchange(userId, 1);

      expect(result).toEqual({ success: true });
    });

    it('취소 시 cash_exchanges도 cancelled로 업데이트된다', async () => {
      repository.setTotalPoints(userId, 10000);
      await service.requestExchange(userId, 5000);

      const exchanges = repository['exchanges'].get(userId)!;
      const pointActionId = exchanges[0].id;

      await service.cancelExchange(userId, pointActionId);

      const cashExchanges = cashExchangeRepository.getAll();
      expect(cashExchanges[0].status).toBe('cancelled');
      expect(cashExchanges[0].cancelled_at).toBeTruthy();
    });

    it('존재하지 않는 출금이면 NotFoundException', async () => {
      await expect(service.cancelExchange(userId, 999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('pending이 아닌 출금은 취소 불가', async () => {
      repository.setExchanges(userId, [
        {
          id: 1,
          user_id: userId,
          type: 'EXCHANGE_POINT_TO_CASH',
          point_amount: -5000,
          status: 'done',
          created_at: '2025-01-01T00:00:00Z',
          additional_data: null,
        },
      ]);

      await expect(service.cancelExchange(userId, 1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('id가 없으면 BadRequestException', async () => {
      await expect(service.cancelExchange(userId, 0)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('approveExchanges', () => {
    it('pending 상태 출금을 일괄 승인한다', async () => {
      repository.setExchanges(userId, [
        {
          id: 1,
          user_id: userId,
          type: 'EXCHANGE_POINT_TO_CASH',
          point_amount: -5000,
          status: 'pending',
          created_at: '2025-01-01T00:00:00Z',
          additional_data: null,
        },
        {
          id: 2,
          user_id: userId,
          type: 'EXCHANGE_POINT_TO_CASH',
          point_amount: -3000,
          status: 'pending',
          created_at: '2025-01-01T00:00:00Z',
          additional_data: null,
        },
      ]);

      const result = await service.approveExchanges([1, 2]);

      expect(result).toEqual({ success: true, count: 2 });
    });

    it('pending이 아닌 건은 무시하고 pending만 승인한다', async () => {
      repository.setExchanges(userId, [
        {
          id: 1,
          user_id: userId,
          type: 'EXCHANGE_POINT_TO_CASH',
          point_amount: -5000,
          status: 'pending',
          created_at: '2025-01-01T00:00:00Z',
          additional_data: null,
        },
        {
          id: 2,
          user_id: userId,
          type: 'EXCHANGE_POINT_TO_CASH',
          point_amount: -3000,
          status: 'done',
          created_at: '2025-01-01T00:00:00Z',
          additional_data: null,
        },
      ]);

      const result = await service.approveExchanges([1, 2]);

      expect(result).toEqual({ success: true, count: 1 });
    });

    it('pending 건이 없으면 BadRequestException', async () => {
      repository.setExchanges(userId, [
        {
          id: 1,
          user_id: userId,
          type: 'EXCHANGE_POINT_TO_CASH',
          point_amount: -5000,
          status: 'done',
          created_at: '2025-01-01T00:00:00Z',
          additional_data: null,
        },
      ]);

      await expect(service.approveExchanges([1])).rejects.toThrow(
        BadRequestException,
      );
    });

    it('승인 시 cash_exchanges도 done으로 업데이트된다', async () => {
      repository.setTotalPoints(userId, 10000);
      await service.requestExchange(userId, 5000);

      const exchanges = repository['exchanges'].get(userId)!;
      const pointActionId = exchanges[0].id;

      await service.approveExchanges([pointActionId]);

      const cashExchanges = cashExchangeRepository.getAll();
      expect(cashExchanges[0].status).toBe('done');
      expect(cashExchanges[0].confirmed_at).toBeTruthy();
    });
  });

  describe('rejectExchange', () => {
    it('pending 상태 출금을 거절한다', async () => {
      repository.setExchanges(userId, [
        {
          id: 1,
          user_id: userId,
          type: 'EXCHANGE_POINT_TO_CASH',
          point_amount: -5000,
          status: 'pending',
          created_at: '2025-01-01T00:00:00Z',
          additional_data: null,
        },
      ]);

      const result = await service.rejectExchange(1, 'invalid_account_number');

      expect(result).toEqual({ success: true });
    });

    it('존재하지 않는 출금이면 NotFoundException', async () => {
      await expect(
        service.rejectExchange(999, 'invalid_account_number'),
      ).rejects.toThrow(NotFoundException);
    });

    it('pending이 아닌 출금은 거절 불가', async () => {
      repository.setExchanges(userId, [
        {
          id: 1,
          user_id: userId,
          type: 'EXCHANGE_POINT_TO_CASH',
          point_amount: -5000,
          status: 'done',
          created_at: '2025-01-01T00:00:00Z',
          additional_data: null,
        },
      ]);

      await expect(
        service.rejectExchange(1, 'invalid_account_number'),
      ).rejects.toThrow(BadRequestException);
    });

    it('거절 시 cash_exchanges도 rejected로 업데이트된다', async () => {
      repository.setTotalPoints(userId, 10000);
      await service.requestExchange(userId, 5000);

      const exchanges = repository['exchanges'].get(userId)!;
      const pointActionId = exchanges[0].id;

      await service.rejectExchange(pointActionId, 'invalid_account_number');

      const cashExchanges = cashExchangeRepository.getAll();
      expect(cashExchanges[0].status).toBe('rejected');
      expect(cashExchanges[0].rejected_at).toBeTruthy();
      expect(cashExchanges[0].reason).toBe('invalid_account_number');
    });
  });
});
