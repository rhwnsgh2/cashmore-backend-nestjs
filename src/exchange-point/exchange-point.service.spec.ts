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
import { POINT_WRITE_SERVICE } from '../point-write/point-write.interface';
import { PointWriteService } from '../point-write/point-write.service';
import { StubPointWriteRepository } from '../point-write/repositories/stub-point-write.repository';

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
    const stubPointWriteRepo = new StubPointWriteRepository();
    repository = new StubExchangePointRepository(stubPointWriteRepo);
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
        {
          provide: POINT_WRITE_SERVICE,
          useFactory: () => new PointWriteService(stubPointWriteRepo),
        },
      ],
    }).compile();

    service = module.get<ExchangePointService>(ExchangePointService);
  });

  describe('getExchangeHistory', () => {
    it('출금 내역을 반환한다 (cash_exchanges에서 조회 + 응답 형식 유지)', async () => {
      await cashExchangeRepository.insert({
        user_id: userId,
        amount: 5000,
        point_action_id: 1,
      });

      const result = await service.getExchangeHistory(userId);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 1,
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
      // 검증 source: cash_exchanges
      await cashExchangeRepository.insert({
        user_id: userId,
        amount: 5000,
        point_action_id: 1,
      });

      const result = await service.cancelExchange(userId, 1);

      expect(result).toEqual({ success: true });
    });

    it('취소 시 cash_exchanges도 cancelled로 업데이트된다', async () => {
      repository.setTotalPoints(userId, 10000);
      await service.requestExchange(userId, 5000);

      const exchanges = repository.getExchangesByUserId(userId);
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
      // 검증 source: cash_exchanges (status='done'으로 setup)
      await cashExchangeRepository.insert({
        user_id: userId,
        amount: 5000,
        point_action_id: 1,
      });
      await cashExchangeRepository.updateStatus(1, 'done', {
        confirmed_at: new Date().toISOString(),
      });

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
      // 검증 source: cash_exchanges
      await cashExchangeRepository.insert({
        user_id: userId,
        amount: 5000,
        point_action_id: 1,
      });
      await cashExchangeRepository.insert({
        user_id: userId,
        amount: 3000,
        point_action_id: 2,
      });

      const result = await service.approveExchanges([1, 2]);

      expect(result).toEqual({ success: true, count: 2 });
    });

    it('pending이 아닌 건은 무시하고 pending만 승인한다', async () => {
      // pending 건
      await cashExchangeRepository.insert({
        user_id: userId,
        amount: 5000,
        point_action_id: 1,
      });
      // done 건
      await cashExchangeRepository.insert({
        user_id: userId,
        amount: 3000,
        point_action_id: 2,
      });
      await cashExchangeRepository.updateStatus(2, 'done', {
        confirmed_at: new Date().toISOString(),
      });

      const result = await service.approveExchanges([1, 2]);

      expect(result).toEqual({ success: true, count: 1 });
    });

    it('pending 건이 없으면 BadRequestException', async () => {
      await cashExchangeRepository.insert({
        user_id: userId,
        amount: 5000,
        point_action_id: 1,
      });
      await cashExchangeRepository.updateStatus(1, 'done', {
        confirmed_at: new Date().toISOString(),
      });

      await expect(service.approveExchanges([1])).rejects.toThrow(
        BadRequestException,
      );
    });

    it('승인 시 cash_exchanges도 done으로 업데이트된다', async () => {
      repository.setTotalPoints(userId, 10000);
      await service.requestExchange(userId, 5000);

      const exchanges = repository.getExchangesByUserId(userId);
      const pointActionId = exchanges[0].id;

      await service.approveExchanges([pointActionId]);

      const cashExchanges = cashExchangeRepository.getAll();
      expect(cashExchanges[0].status).toBe('done');
      expect(cashExchanges[0].confirmed_at).toBeTruthy();
    });
  });

  describe('rejectExchange', () => {
    it('pending 상태 출금을 거절한다', async () => {
      await cashExchangeRepository.insert({
        user_id: userId,
        amount: 5000,
        point_action_id: 1,
      });

      const result = await service.rejectExchange(1, 'invalid_account_number');

      expect(result).toEqual({ success: true });
    });

    it('존재하지 않는 출금이면 NotFoundException', async () => {
      await expect(
        service.rejectExchange(999, 'invalid_account_number'),
      ).rejects.toThrow(NotFoundException);
    });

    it('pending이 아닌 출금은 거절 불가', async () => {
      await cashExchangeRepository.insert({
        user_id: userId,
        amount: 5000,
        point_action_id: 1,
      });
      await cashExchangeRepository.updateStatus(1, 'done', {
        confirmed_at: new Date().toISOString(),
      });

      await expect(
        service.rejectExchange(1, 'invalid_account_number'),
      ).rejects.toThrow(BadRequestException);
    });

    it('거절 시 cash_exchanges도 rejected로 업데이트된다', async () => {
      repository.setTotalPoints(userId, 10000);
      await service.requestExchange(userId, 5000);

      const exchanges = repository.getExchangesByUserId(userId);
      const pointActionId = exchanges[0].id;

      await service.rejectExchange(pointActionId, 'invalid_account_number');

      const cashExchanges = cashExchangeRepository.getAll();
      expect(cashExchanges[0].status).toBe('rejected');
      expect(cashExchanges[0].rejected_at).toBeTruthy();
      expect(cashExchanges[0].reason).toBe('invalid_account_number');
    });
  });

  // ============================================================
  // Phase 3: 네이버페이 패턴 (point_actions 원장화) 검증
  // ============================================================
  describe('Phase 3: 네이버페이 패턴 검증', () => {
    describe('requestExchange — point_actions에 status="done"으로 INSERT', () => {
      it('신청 시 point_actions에 -amount, status="done"으로 INSERT된다', async () => {
        repository.setTotalPoints(userId, 10000);

        await service.requestExchange(userId, 5000);

        const exchanges = repository.getExchangesByUserId(userId);
        expect(exchanges).toHaveLength(1);
        expect(exchanges[0]).toMatchObject({
          user_id: userId,
          type: 'EXCHANGE_POINT_TO_CASH',
          point_amount: -5000,
          status: 'done', // ⚠️ Phase 3: pending이 아닌 done
        });
      });

      it('신청 즉시 cash_exchanges에는 status="pending"으로 INSERT된다', async () => {
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

      it('신청 즉시 잔액에서 차감된다 (point_actions의 합)', async () => {
        repository.setTotalPoints(userId, 10000);

        await service.requestExchange(userId, 5000);

        const total = await repository.getTotalPoints(userId);
        expect(total).toBe(5000); // 10000 - 5000
      });
    });

    describe('cancelExchange — 복원 행 INSERT 패턴', () => {
      it('취소 시 point_actions에 +amount 복원 행이 INSERT된다 (원본 행은 그대로)', async () => {
        repository.setTotalPoints(userId, 10000);
        await service.requestExchange(userId, 5000);
        const originalId = repository.getExchangesByUserId(userId)[0].id;

        await service.cancelExchange(userId, originalId);

        const exchanges = repository.getExchangesByUserId(userId);
        expect(exchanges).toHaveLength(2);
        // 원본 deduct 행 (status='done', -5000) — 그대로
        expect(exchanges[0]).toMatchObject({
          id: originalId,
          point_amount: -5000,
          status: 'done', // ⚠️ cancelled로 변경 안 됨
        });
        // 복원 행 (status='done', +5000)
        expect(exchanges[1]).toMatchObject({
          point_amount: 5000,
          status: 'done',
          additional_data: expect.objectContaining({
            original_point_action_id: originalId,
            reason: 'cancelled',
          }),
        });
      });

      it('취소 후 잔액 net = 0 (deduct + restore)', async () => {
        repository.setTotalPoints(userId, 10000);
        await service.requestExchange(userId, 5000);
        const originalId = repository.getExchangesByUserId(userId)[0].id;

        await service.cancelExchange(userId, originalId);

        const total = await repository.getTotalPoints(userId);
        expect(total).toBe(10000); // 차감 -5000 + 복원 +5000 = 0, 잔액 그대로
      });

      it('취소 시 cash_exchanges status는 cancelled로 변경된다', async () => {
        repository.setTotalPoints(userId, 10000);
        await service.requestExchange(userId, 5000);
        const originalId = repository.getExchangesByUserId(userId)[0].id;

        await service.cancelExchange(userId, originalId);

        const cashExchanges = cashExchangeRepository.getAll();
        expect(cashExchanges[0].status).toBe('cancelled');
        expect(cashExchanges[0].cancelled_at).toBeTruthy();
      });
    });

    describe('approveExchanges — point_actions 변동 없음', () => {
      it('승인 시 point_actions에 추가 INSERT나 UPDATE가 없다', async () => {
        repository.setTotalPoints(userId, 10000);
        await service.requestExchange(userId, 5000);
        const originalId = repository.getExchangesByUserId(userId)[0].id;

        await service.approveExchanges([originalId]);

        const exchanges = repository.getExchangesByUserId(userId);
        // 신청 시 INSERT된 1행 그대로
        expect(exchanges).toHaveLength(1);
        expect(exchanges[0]).toMatchObject({
          point_amount: -5000,
          status: 'done', // 변경 없음
        });
      });

      it('승인 후 잔액은 -amount (영구 차감)', async () => {
        repository.setTotalPoints(userId, 10000);
        await service.requestExchange(userId, 5000);
        const originalId = repository.getExchangesByUserId(userId)[0].id;

        await service.approveExchanges([originalId]);

        const total = await repository.getTotalPoints(userId);
        expect(total).toBe(5000); // 차감 영구
      });

      it('승인 시 cash_exchanges status는 done으로 변경된다', async () => {
        repository.setTotalPoints(userId, 10000);
        await service.requestExchange(userId, 5000);
        const originalId = repository.getExchangesByUserId(userId)[0].id;

        await service.approveExchanges([originalId]);

        const cashExchanges = cashExchangeRepository.getAll();
        expect(cashExchanges[0].status).toBe('done');
        expect(cashExchanges[0].confirmed_at).toBeTruthy();
      });
    });

    describe('rejectExchange — 복원 행 INSERT 패턴', () => {
      it('거절 시 point_actions에 +amount 복원 행이 INSERT된다 (원본 행은 그대로)', async () => {
        repository.setTotalPoints(userId, 10000);
        await service.requestExchange(userId, 5000);
        const originalId = repository.getExchangesByUserId(userId)[0].id;

        await service.rejectExchange(originalId, 'invalid_account_number');

        const exchanges = repository.getExchangesByUserId(userId);
        expect(exchanges).toHaveLength(2);
        expect(exchanges[0]).toMatchObject({
          id: originalId,
          point_amount: -5000,
          status: 'done',
        });
        expect(exchanges[1]).toMatchObject({
          point_amount: 5000,
          status: 'done',
          additional_data: expect.objectContaining({
            original_point_action_id: originalId,
            reason: 'rejected_invalid_account_number',
          }),
        });
      });

      it('거절 후 잔액 net = 0', async () => {
        repository.setTotalPoints(userId, 10000);
        await service.requestExchange(userId, 5000);
        const originalId = repository.getExchangesByUserId(userId)[0].id;

        await service.rejectExchange(originalId, 'invalid_account_number');

        const total = await repository.getTotalPoints(userId);
        expect(total).toBe(10000); // 차감 + 복원 = 0
      });
    });

    describe('통합 시나리오 — 잔액 정합성 검증 (가장 중요)', () => {
      it('시나리오 1: 5000 신청만 → 잔액 5000', async () => {
        repository.setTotalPoints(userId, 10000);

        await service.requestExchange(userId, 5000);

        expect(await repository.getTotalPoints(userId)).toBe(5000);
      });

      it('시나리오 2: 5000 신청 → 취소 → 잔액 10000 (원복)', async () => {
        repository.setTotalPoints(userId, 10000);

        await service.requestExchange(userId, 5000);
        const id = repository.getExchangesByUserId(userId)[0].id;
        await service.cancelExchange(userId, id);

        expect(await repository.getTotalPoints(userId)).toBe(10000);
      });

      it('시나리오 3: 5000 신청 → 승인 → 잔액 5000 (영구 차감)', async () => {
        repository.setTotalPoints(userId, 10000);

        await service.requestExchange(userId, 5000);
        const id = repository.getExchangesByUserId(userId)[0].id;
        await service.approveExchanges([id]);

        expect(await repository.getTotalPoints(userId)).toBe(5000);
      });

      it('시나리오 4: 5000 신청 → 거절 → 잔액 10000 (원복)', async () => {
        repository.setTotalPoints(userId, 10000);

        await service.requestExchange(userId, 5000);
        const id = repository.getExchangesByUserId(userId)[0].id;
        await service.rejectExchange(id, 'invalid_account_number');

        expect(await repository.getTotalPoints(userId)).toBe(10000);
      });

      it('시나리오 5: 5000 + 3000 신청 → 그 중 3000 취소 → 잔액 5000', async () => {
        repository.setTotalPoints(userId, 10000);

        await service.requestExchange(userId, 5000);
        await service.requestExchange(userId, 3000);
        const secondId = repository.getExchangesByUserId(userId)[1].id;

        // 8000 차감
        expect(await repository.getTotalPoints(userId)).toBe(2000);

        await service.cancelExchange(userId, secondId);

        // 3000 복원
        expect(await repository.getTotalPoints(userId)).toBe(5000);

        // first는 그대로, 자동 검증
        const exchanges = repository.getExchangesByUserId(userId);
        expect(exchanges).toHaveLength(3); // deduct 2 + restore 1
      });

      it('시나리오 6: 신청 → 승인 → 잔액 변동 후 다시 신청 → 잔액 정확', async () => {
        repository.setTotalPoints(userId, 10000);

        // 5000 신청 + 승인
        await service.requestExchange(userId, 5000);
        const firstId = repository.getExchangesByUserId(userId)[0].id;
        await service.approveExchanges([firstId]);
        expect(await repository.getTotalPoints(userId)).toBe(5000);

        // 추가로 3000 신청
        await service.requestExchange(userId, 3000);
        expect(await repository.getTotalPoints(userId)).toBe(2000);
      });

      it('시나리오 7: 신청 → 취소 → 다시 신청 → 잔액 정확', async () => {
        repository.setTotalPoints(userId, 10000);

        // 5000 신청 + 취소
        await service.requestExchange(userId, 5000);
        const firstId = repository.getExchangesByUserId(userId)[0].id;
        await service.cancelExchange(userId, firstId);
        expect(await repository.getTotalPoints(userId)).toBe(10000);

        // 다시 5000 신청
        await service.requestExchange(userId, 5000);
        expect(await repository.getTotalPoints(userId)).toBe(5000);
      });

      it('시나리오 8: 5000 신청 → 거절 → 다시 5000 신청 → 승인 → 잔액 5000', async () => {
        repository.setTotalPoints(userId, 10000);

        // 첫 신청 + 거절
        await service.requestExchange(userId, 5000);
        const firstId = repository.getExchangesByUserId(userId)[0].id;
        await service.rejectExchange(firstId, 'invalid_account_number');
        expect(await repository.getTotalPoints(userId)).toBe(10000);

        // 두 번째 신청 + 승인
        await service.requestExchange(userId, 5000);
        const secondId = repository.getExchangesByUserId(userId)[2].id; // [0]: deduct, [1]: restore, [2]: 새 deduct
        await service.approveExchanges([secondId]);
        expect(await repository.getTotalPoints(userId)).toBe(5000);
      });

      it('시나리오 9: 여러 건 일괄 승인 — 일부는 done, 일부는 pending', async () => {
        repository.setTotalPoints(userId, 20000);

        // 3건 신청
        await service.requestExchange(userId, 5000);
        const id1 = repository.getExchangesByUserId(userId)[0].id;
        await service.requestExchange(userId, 3000);
        const id2 = repository.getExchangesByUserId(userId)[1].id;
        await service.requestExchange(userId, 2000);
        const id3 = repository.getExchangesByUserId(userId)[2].id;

        expect(await repository.getTotalPoints(userId)).toBe(10000); // 20000 - 10000

        // id2는 먼저 취소
        await service.cancelExchange(userId, id2);
        expect(await repository.getTotalPoints(userId)).toBe(13000); // 10000 + 3000 복원

        // id1, id3 일괄 승인
        await service.approveExchanges([id1, id3]);
        expect(await repository.getTotalPoints(userId)).toBe(13000); // 변동 없음

        // 최종 cash_exchanges 상태
        const cashExchanges = cashExchangeRepository.getAll();
        const sortedById = [...cashExchanges].sort((a, b) => a.id - b.id);
        expect(sortedById[0].status).toBe('done'); // id1
        expect(sortedById[1].status).toBe('cancelled'); // id2
        expect(sortedById[2].status).toBe('done'); // id3
      });
    });
  });

  // ============================================================
  // getCashExchangeDetail (어드민 단건 상세 조회)
  // ============================================================
  describe('getCashExchangeDetail', () => {
    it('존재하지 않는 id면 NotFoundException', async () => {
      await expect(service.getCashExchangeDetail(99999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('pending 거래는 deduct 행 1개 반환, netAmount = -amount', async () => {
      repository.setTotalPoints(userId, 10000);
      await service.requestExchange(userId, 5000);

      const cashExchanges = cashExchangeRepository.getAll();
      const ceId = cashExchanges[0].id;

      const detail = await service.getCashExchangeDetail(ceId);

      expect(detail.id).toBe(ceId);
      expect(detail.userId).toBe(userId);
      expect(detail.amount).toBe(5000);
      expect(detail.status).toBe('pending');
      expect(detail.pointActions).toHaveLength(1);
      expect(detail.pointActions[0]).toMatchObject({
        pointAmount: -5000,
        role: 'deduct',
      });
      expect(detail.netAmount).toBe(-5000);
    });

    it('취소된 거래는 deduct + restore 행 2개 반환, netAmount = 0', async () => {
      repository.setTotalPoints(userId, 10000);
      await service.requestExchange(userId, 5000);

      const cashExchanges = cashExchangeRepository.getAll();
      const ceId = cashExchanges[0].id;
      const pointActionId = cashExchanges[0].point_action_id as number;

      await service.cancelExchange(userId, pointActionId);

      const detail = await service.getCashExchangeDetail(ceId);

      expect(detail.status).toBe('cancelled');
      expect(detail.pointActions).toHaveLength(2);

      const deduct = detail.pointActions.find((p) => p.role === 'deduct')!;
      const restore = detail.pointActions.find((p) => p.role === 'restore')!;

      expect(deduct.pointAmount).toBe(-5000);
      expect(restore.pointAmount).toBe(5000);
      expect(restore.additionalData).toMatchObject({
        original_point_action_id: pointActionId,
        reason: 'cancelled',
      });

      expect(detail.netAmount).toBe(0);
    });

    it('승인된 거래는 deduct 행 1개만 반환 (point_actions 변동 없음), netAmount = -amount', async () => {
      repository.setTotalPoints(userId, 10000);
      await service.requestExchange(userId, 5000);

      const cashExchanges = cashExchangeRepository.getAll();
      const ceId = cashExchanges[0].id;
      const pointActionId = cashExchanges[0].point_action_id as number;

      await service.approveExchanges([pointActionId]);

      const detail = await service.getCashExchangeDetail(ceId);

      expect(detail.status).toBe('done');
      expect(detail.pointActions).toHaveLength(1);
      expect(detail.pointActions[0].role).toBe('deduct');
      expect(detail.netAmount).toBe(-5000);
    });

    it('거절된 거래는 deduct + restore 2개 반환, netAmount = 0, restore.reason = rejected_*', async () => {
      repository.setTotalPoints(userId, 10000);
      await service.requestExchange(userId, 5000);

      const cashExchanges = cashExchangeRepository.getAll();
      const ceId = cashExchanges[0].id;
      const pointActionId = cashExchanges[0].point_action_id as number;

      await service.rejectExchange(pointActionId, 'invalid_account_number');

      const detail = await service.getCashExchangeDetail(ceId);

      expect(detail.status).toBe('rejected');
      expect(detail.pointActions).toHaveLength(2);

      const restore = detail.pointActions.find((p) => p.role === 'restore')!;
      expect(restore.additionalData).toMatchObject({
        original_point_action_id: pointActionId,
        reason: 'rejected_invalid_account_number',
      });

      expect(detail.netAmount).toBe(0);
    });

    it('다른 거래의 복원 행은 포함되지 않는다', async () => {
      repository.setTotalPoints(userId, 20000);

      // 첫 거래: 신청 + 취소
      await service.requestExchange(userId, 5000);
      const firstCe = cashExchangeRepository.getAll()[0];
      await service.cancelExchange(userId, firstCe.point_action_id as number);

      // 두 번째 거래: 신청만
      await service.requestExchange(userId, 3000);
      const secondCe = cashExchangeRepository
        .getAll()
        .find((e) => e.id !== firstCe.id)!;

      // 첫 거래 detail은 deduct + restore 2개만
      const firstDetail = await service.getCashExchangeDetail(firstCe.id);
      expect(firstDetail.pointActions).toHaveLength(2);
      expect(firstDetail.netAmount).toBe(0);

      // 두 번째 거래 detail은 deduct 1개만
      const secondDetail = await service.getCashExchangeDetail(secondCe.id);
      expect(secondDetail.pointActions).toHaveLength(1);
      expect(secondDetail.netAmount).toBe(-3000);
    });
  });
});
