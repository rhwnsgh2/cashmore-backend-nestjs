import { Test, TestingModule } from '@nestjs/testing';
import { UserModalService } from './user-modal.service';
import { USER_MODAL_REPOSITORY } from './interfaces/user-modal-repository.interface';
import { StubUserModalRepository } from './repositories/stub-user-modal.repository';

describe('UserModalService', () => {
  let service: UserModalService;
  let repository: StubUserModalRepository;

  const userId = 'test-user-id';

  beforeEach(async () => {
    repository = new StubUserModalRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserModalService,
        { provide: USER_MODAL_REPOSITORY, useValue: repository },
      ],
    }).compile();

    service = module.get<UserModalService>(UserModalService);
  });

  afterEach(() => {
    repository.clear();
  });

  describe('completeModal', () => {
    it('존재하는 모달을 완료 처리하면 success: true를 반환한다', async () => {
      repository.setModals(userId, [
        {
          id: 1,
          name: 'onboarding',
          status: 'pending',
          additionalData: null,
        },
      ]);

      const result = await service.completeModal(userId, 1);

      expect(result.success).toBe(true);
    });

    it('완료 처리 후 해당 모달의 상태가 completed로 변경된다', async () => {
      repository.setModals(userId, [
        {
          id: 1,
          name: 'onboarding',
          status: 'pending',
          additionalData: null,
        },
      ]);

      await service.completeModal(userId, 1);

      const modals = await service.getPendingModals(userId);
      expect(modals.modals).toHaveLength(0);
    });

    it('존재하지 않는 모달 ID여도 success: true를 반환한다', async () => {
      const result = await service.completeModal(userId, 999);

      expect(result.success).toBe(true);
    });

    it('다른 사용자의 모달을 지정해도 success: true를 반환하지만 실제 변경은 없다', async () => {
      repository.setModals('other-user', [
        {
          id: 1,
          name: 'onboarding',
          status: 'pending',
          additionalData: null,
        },
      ]);

      const result = await service.completeModal(userId, 1);

      expect(result.success).toBe(true);

      // other-user의 모달은 여전히 pending
      const otherModals = await service.getPendingModals('other-user');
      expect(otherModals.modals).toHaveLength(1);
      expect(otherModals.modals[0].status).toBe('pending');
    });
  });

  describe('getPendingModals', () => {
    it('대기 중인 모달이 없으면 빈 배열을 반환한다', async () => {
      const result = await service.getPendingModals(userId);

      expect(result.success).toBe(true);
      expect(result.modals).toEqual([]);
    });

    it('대기 중인 모달 목록을 반환한다', async () => {
      repository.setModals(userId, [
        {
          id: 1,
          name: 'onboarding',
          status: 'pending',
          additionalData: null,
        },
        {
          id: 2,
          name: 'interview',
          status: 'pending',
          additionalData: { amount: 1000 },
        },
      ]);

      const result = await service.getPendingModals(userId);

      expect(result.success).toBe(true);
      expect(result.modals).toHaveLength(2);
      expect(result.modals[0].name).toBe('onboarding');
      expect(result.modals[1].name).toBe('interview');
    });

    it('completed 상태의 모달은 포함하지 않는다', async () => {
      repository.setModals(userId, [
        {
          id: 1,
          name: 'onboarding',
          status: 'pending',
          additionalData: null,
        },
        {
          id: 2,
          name: 'interview',
          status: 'completed',
          additionalData: null,
        },
      ]);

      const result = await service.getPendingModals(userId);

      expect(result.success).toBe(true);
      expect(result.modals).toHaveLength(1);
      expect(result.modals[0].name).toBe('onboarding');
    });

    it('additionalData를 올바르게 반환한다', async () => {
      repository.setModals(userId, [
        {
          id: 1,
          name: 'exchange_point_to_cash',
          status: 'pending',
          additionalData: { amount: 5000, bankName: '신한은행' },
        },
      ]);

      const result = await service.getPendingModals(userId);

      expect(result.success).toBe(true);
      expect(result.modals).toHaveLength(1);
      expect(result.modals[0].additionalData).toEqual({
        amount: 5000,
        bankName: '신한은행',
      });
    });

    it('다른 사용자의 모달은 포함하지 않는다', async () => {
      const otherUserId = 'other-user-id';

      repository.setModals(userId, [
        {
          id: 1,
          name: 'onboarding',
          status: 'pending',
          additionalData: null,
        },
      ]);

      repository.setModals(otherUserId, [
        {
          id: 2,
          name: 'interview',
          status: 'pending',
          additionalData: null,
        },
      ]);

      const result = await service.getPendingModals(userId);

      expect(result.success).toBe(true);
      expect(result.modals).toHaveLength(1);
      expect(result.modals[0].name).toBe('onboarding');
    });
  });
});
