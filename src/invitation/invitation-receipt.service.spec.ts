import { Test, TestingModule } from '@nestjs/testing';
import { InvitationService } from './invitation.service';
import { INVITATION_REPOSITORY } from './interfaces/invitation-repository.interface';
import { StubInvitationRepository } from './repositories/stub-invitation.repository';
import { USER_MODAL_REPOSITORY } from '../user-modal/interfaces/user-modal-repository.interface';
import { StubUserModalRepository } from '../user-modal/repositories/stub-user-modal.repository';
import { FcmService } from '../fcm/fcm.service';
import { SlackService } from '../slack/slack.service';

describe('InvitationService - invitation_receipt', () => {
  let service: InvitationService;
  let repository: StubInvitationRepository;
  let modalRepository: StubUserModalRepository;
  const invitedUserId = 'invited-user-id';

  beforeEach(async () => {
    repository = new StubInvitationRepository();
    modalRepository = new StubUserModalRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvitationService,
        {
          provide: INVITATION_REPOSITORY,
          useValue: repository,
        },
        {
          provide: USER_MODAL_REPOSITORY,
          useValue: modalRepository,
        },
        {
          provide: FcmService,
          useValue: {
            sendRefreshMessage: async () => {},
            pushNotification: async () => {},
          },
        },
        {
          provide: SlackService,
          useValue: {
            reportBugToSlack: async () => {},
            reportToInvitationNoti: async () => {},
          },
        },
      ],
    }).compile();

    service = module.get<InvitationService>(InvitationService);
  });

  it('피초대자에게 INVITATION_RECEIPT 타입으로 포인트를 지급한다', async () => {
    repository.setEveryReceipt({
      id: 99,
      user_id: 'inviter-id',
      point: 40,
      status: 'completed',
      image_url: 'https://storage.example.com/receipt.jpg',
      score_data: { total_score: 30 },
      created_at: new Date().toISOString(),
    });

    const result = await service.grantReceiptPoint({
      receiptId: 99,
      invitedUserId,
    });

    expect(result.receiptPoint).toBe(40);

    const pointActions = repository.getPointActions();
    const receiptAction = pointActions.find(
      (p) => p.userId === invitedUserId && p.type === 'INVITATION_RECEIPT',
    );
    expect(receiptAction).toBeDefined();
    expect(receiptAction!.pointAmount).toBe(40);
    expect(receiptAction!.additionalData).toEqual({
      source_receipt_id: 99,
      point: 40,
    });
  });

  it('존재하지 않는 영수증 ID이면 에러를 던진다', async () => {
    await expect(
      service.grantReceiptPoint({
        receiptId: 999,
        invitedUserId,
      }),
    ).rejects.toThrow();
  });

  it('completed가 아닌 영수증이면 에러를 던진다', async () => {
    repository.setEveryReceipt({
      id: 100,
      user_id: 'inviter-id',
      point: 0,
      status: 'pending',
      image_url: 'https://storage.example.com/receipt.jpg',
      score_data: null,
      created_at: new Date().toISOString(),
    });

    await expect(
      service.grantReceiptPoint({
        receiptId: 100,
        invitedUserId,
      }),
    ).rejects.toThrow();
  });

  it('영수증 생성 후 12분 초과하면 에러를 던진다', async () => {
    const thirteenMinutesAgo = new Date(
      Date.now() - 13 * 60 * 1000,
    ).toISOString();
    repository.setEveryReceipt({
      id: 102,
      user_id: 'inviter-id',
      point: 40,
      status: 'completed',
      image_url: 'https://storage.example.com/receipt.jpg',
      score_data: { total_score: 30 },
      created_at: thirteenMinutesAgo,
    });

    await expect(
      service.grantReceiptPoint({
        receiptId: 102,
        invitedUserId,
      }),
    ).rejects.toThrow('유효 시간이 초과된 영수증입니다.');
  });

  it('영수증 포인트가 0이면 포인트 0으로 지급된다', async () => {
    repository.setEveryReceipt({
      id: 101,
      user_id: 'inviter-id',
      point: 0,
      status: 'completed',
      image_url: 'https://storage.example.com/receipt.jpg',
      score_data: { total_score: 0 },
      created_at: new Date().toISOString(),
    });

    const result = await service.grantReceiptPoint({
      receiptId: 101,
      invitedUserId,
    });

    expect(result.receiptPoint).toBe(0);

    const pointActions = repository.getPointActions();
    const receiptAction = pointActions.find(
      (p) => p.userId === invitedUserId && p.type === 'INVITATION_RECEIPT',
    );
    expect(receiptAction).toBeDefined();
    expect(receiptAction!.pointAmount).toBe(0);
  });
});
