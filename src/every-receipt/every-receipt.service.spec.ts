import { Test, TestingModule } from '@nestjs/testing';
import { EveryReceiptService } from './every-receipt.service';
import { EVERY_RECEIPT_REPOSITORY } from './interfaces/every-receipt-repository.interface';
import type {
  ScoreData,
  InsertPointReversalParams,
  PointReversalReason,
} from './interfaces/every-receipt-repository.interface';
import { StubEveryReceiptRepository } from './repositories/stub-every-receipt.repository';
import type { ReceiptQueueMessage } from './receipt-queue.service';
import { ReceiptQueueService } from './receipt-queue.service';
import type { AmplitudeEventProperties } from '../amplitude/amplitude.service';
import { AmplitudeService } from '../amplitude/amplitude.service';
import { EventService } from '../event/event.service';
import { OnboardingService } from '../onboarding/onboarding.service';
import { FcmService } from '../fcm/fcm.service';
import { UserModalService } from '../user-modal/user-modal.service';
import type { UserModalType } from '../user-modal/interfaces/user-modal-repository.interface';
import { SlackService } from '../slack/slack.service';
import { POINT_WRITE_SERVICE } from '../point-write/point-write.interface';
import { PointWriteService } from '../point-write/point-write.service';
import { StubPointWriteRepository } from '../point-write/repositories/stub-point-write.repository';

interface TrackedEvent {
  eventType: string;
  userId: string;
  properties?: AmplitudeEventProperties;
}

class StubAmplitudeService {
  private events: TrackedEvent[] = [];

  track(
    eventType: string,
    userId: string,
    eventProperties?: AmplitudeEventProperties,
  ): void {
    this.events.push({ eventType, userId, properties: eventProperties });
  }

  getEvents(): TrackedEvent[] {
    return this.events;
  }

  clear(): void {
    this.events = [];
  }
}

class StubReceiptQueueService {
  private messages: ReceiptQueueMessage[] = [];
  private shouldFail = false;

  publish(message: ReceiptQueueMessage): Promise<string> {
    if (this.shouldFail) {
      return Promise.reject(new Error('PubSub publish failed'));
    }
    this.messages.push(message);
    return Promise.resolve('test-message-id');
  }

  getMessages(): ReceiptQueueMessage[] {
    return this.messages;
  }

  setShouldFail(fail: boolean): void {
    this.shouldFail = fail;
  }

  clear(): void {
    this.messages = [];
    this.shouldFail = false;
  }
}

class StubEventService {
  private doublePointActive = false;

  setDoublePointActive(active: boolean): void {
    this.doublePointActive = active;
  }

  isDoublePointActive(_userId: string): Promise<boolean> {
    return Promise.resolve(this.doublePointActive);
  }

  clear(): void {
    this.doublePointActive = false;
  }
}

class StubOnboardingService {
  private eventStatus = false;

  setEventStatus(status: boolean): void {
    this.eventStatus = status;
  }

  getEventStatus(_userId: string): Promise<boolean> {
    return Promise.resolve(this.eventStatus);
  }

  clear(): void {
    this.eventStatus = false;
  }
}

class StubFcmService {
  private pushNotifications: {
    userId: string;
    title: string;
    body: string;
  }[] = [];
  private refreshMessages: { userId: string; type: string }[] = [];

  pushNotification(userId: string, title: string, body: string): Promise<void> {
    this.pushNotifications.push({ userId, title, body });
    return Promise.resolve();
  }

  sendRefreshMessage(userId: string, type: string): Promise<void> {
    this.refreshMessages.push({ userId, type });
    return Promise.resolve();
  }

  getPushNotifications() {
    return this.pushNotifications;
  }

  getRefreshMessages() {
    return this.refreshMessages;
  }

  clear(): void {
    this.pushNotifications = [];
    this.refreshMessages = [];
  }
}

class StubUserModalService {
  private created: {
    userId: string;
    name: UserModalType;
    additionalData?: Record<string, unknown>;
  }[] = [];

  createModal(
    userId: string,
    name: UserModalType,
    additionalData?: Record<string, unknown>,
  ): Promise<void> {
    this.created.push({ userId, name, additionalData });
    return Promise.resolve();
  }

  getCreatedModals() {
    return this.created;
  }

  clear(): void {
    this.created = [];
  }
}

class StubSlackService {
  private bugReports: string[] = [];

  reportBugToSlack(contents: string): Promise<void> {
    this.bugReports.push(contents);
    return Promise.resolve();
  }

  getBugReports() {
    return this.bugReports;
  }

  clear(): void {
    this.bugReports = [];
  }
}

function makeScoreData(overrides: Partial<ScoreData> = {}): ScoreData {
  return {
    items: { score: 10, reason: 'good' },
    store_name: { score: 5, reason: 'found' },
    total_score: 80,
    receipt_type: { score: 25, reason: 'offline' },
    date_validity: { score: 15, reason: 'valid' },
    image_quality: { score: 10, reason: 'clear', image_quality: 5 },
    store_details: { score: 5, reason: 'found' },
    payment_amount: { score: 5, reason: 'found' },
    payment_method: { score: 5, reason: 'found' },
    is_duplicate_receipt: false,
    same_store_count_with_in_7_days: { score: 0, reason: 'first' },
    ...overrides,
  };
}

describe('EveryReceiptService', () => {
  let service: EveryReceiptService;
  let repository: StubEveryReceiptRepository;
  let queueService: StubReceiptQueueService;
  let amplitudeService: StubAmplitudeService;
  let eventService: StubEventService;
  let onboardingService: StubOnboardingService;
  let fcmService: StubFcmService;
  let userModalService: StubUserModalService;
  let slackService: StubSlackService;
  let pointWriteRepository: StubPointWriteRepository;

  const userId = 'test-user-id';

  beforeEach(async () => {
    repository = new StubEveryReceiptRepository();
    queueService = new StubReceiptQueueService();
    amplitudeService = new StubAmplitudeService();
    eventService = new StubEventService();
    onboardingService = new StubOnboardingService();
    fcmService = new StubFcmService();
    userModalService = new StubUserModalService();
    slackService = new StubSlackService();
    pointWriteRepository = new StubPointWriteRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EveryReceiptService,
        { provide: EVERY_RECEIPT_REPOSITORY, useValue: repository },
        { provide: ReceiptQueueService, useValue: queueService },
        { provide: AmplitudeService, useValue: amplitudeService },
        { provide: EventService, useValue: eventService },
        { provide: OnboardingService, useValue: onboardingService },
        { provide: FcmService, useValue: fcmService },
        { provide: UserModalService, useValue: userModalService },
        { provide: SlackService, useValue: slackService },
        {
          provide: POINT_WRITE_SERVICE,
          useFactory: () => new PointWriteService(pointWriteRepository),
        },
      ],
    }).compile();

    service = module.get<EveryReceiptService>(EveryReceiptService);
  });

  const getInsertedReversals = (): InsertPointReversalParams[] =>
    pointWriteRepository
      .getInsertedActions()
      .filter(
        (a) =>
          a.type === 'EVERY_RECEIPT' &&
          typeof a.additionalData.reason === 'string',
      )
      .map((a) => {
        const result: InsertPointReversalParams = {
          userId: a.userId,
          pointAmount: a.amount,
          everyReceiptId: a.additionalData.every_receipt_id as number,
          reason: a.additionalData.reason as PointReversalReason,
        };
        if (a.additionalData.every_receipt_re_review_id !== undefined) {
          result.everyReceiptReReviewId = a.additionalData
            .every_receipt_re_review_id as number;
        }
        if (a.additionalData.before_point !== undefined) {
          result.beforePoint = a.additionalData.before_point as number;
        }
        if (a.additionalData.after_point !== undefined) {
          result.afterPoint = a.additionalData.after_point as number;
        }
        return result;
      });

  afterEach(() => {
    repository.clear();
    queueService.clear();
    amplitudeService.clear();
    eventService.clear();
    onboardingService.clear();
    fcmService.clear();
    userModalService.clear();
    slackService.clear();
    pointWriteRepository.clear();
  });

  describe('getEveryReceipts', () => {
    it('영수증이 없으면 빈 배열을 반환한다', async () => {
      const result = await service.getEveryReceipts(userId);

      expect(result).toEqual([]);
    });

    it('영수증 목록을 반환한다', async () => {
      repository.setReceipts(userId, [
        {
          id: 'receipt-1',
          createdAt: '2026-01-15T10:00:00+09:00',
          pointAmount: 250,
          status: 'completed',
          imageUrl: 'https://example.com/image1.jpg',
        },
        {
          id: 'receipt-2',
          createdAt: '2026-01-14T10:00:00+09:00',
          pointAmount: 200,
          status: 'completed',
          imageUrl: 'https://example.com/image2.jpg',
        },
      ]);

      const result = await service.getEveryReceipts(userId);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('receipt-1');
      expect(result[1].id).toBe('receipt-2');
    });

    it('영수증을 최신순으로 정렬하여 반환한다', async () => {
      repository.setReceipts(userId, [
        {
          id: 'receipt-old',
          createdAt: '2026-01-10T10:00:00+09:00',
          pointAmount: 100,
          status: 'completed',
          imageUrl: null,
        },
        {
          id: 'receipt-new',
          createdAt: '2026-01-15T10:00:00+09:00',
          pointAmount: 250,
          status: 'completed',
          imageUrl: null,
        },
      ]);

      const result = await service.getEveryReceipts(userId);

      expect(result[0].id).toBe('receipt-new');
      expect(result[1].id).toBe('receipt-old');
    });

    it('pending 상태의 영수증도 포함한다', async () => {
      repository.setReceipts(userId, [
        {
          id: 'receipt-pending',
          createdAt: '2026-01-15T10:00:00+09:00',
          pointAmount: null,
          status: 'pending',
          imageUrl: 'https://example.com/image.jpg',
        },
      ]);

      const result = await service.getEveryReceipts(userId);

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('pending');
      expect(result[0].pointAmount).toBeNull();
    });

    it('rejected 상태의 영수증도 포함한다', async () => {
      repository.setReceipts(userId, [
        {
          id: 'receipt-rejected',
          createdAt: '2026-01-15T10:00:00+09:00',
          pointAmount: null,
          status: 'rejected',
          imageUrl: 'https://example.com/image.jpg',
        },
      ]);

      const result = await service.getEveryReceipts(userId);

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('rejected');
    });

    it('다른 사용자의 영수증은 포함하지 않는다', async () => {
      const otherUserId = 'other-user-id';

      repository.setReceipts(userId, [
        {
          id: 'my-receipt',
          createdAt: '2026-01-15T10:00:00+09:00',
          pointAmount: 250,
          status: 'completed',
          imageUrl: null,
        },
      ]);

      repository.setReceipts(otherUserId, [
        {
          id: 'other-receipt',
          createdAt: '2026-01-15T10:00:00+09:00',
          pointAmount: 300,
          status: 'completed',
          imageUrl: null,
        },
      ]);

      const result = await service.getEveryReceipts(userId);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('my-receipt');
    });
  });

  describe('getMonthlyReceiptCount', () => {
    it('이번 달 completed 영수증 갯수를 반환한다', async () => {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;

      repository.setReceipts(userId, [
        {
          id: 'receipt-1',
          createdAt: new Date(year, month - 1, 5).toISOString(),
          pointAmount: 250,
          status: 'completed',
          imageUrl: null,
        },
        {
          id: 'receipt-2',
          createdAt: new Date(year, month - 1, 10).toISOString(),
          pointAmount: 200,
          status: 'completed',
          imageUrl: null,
        },
      ]);

      const result = await service.getMonthlyReceiptCount(userId);

      expect(result.count).toBe(2);
    });

    it('pending/rejected 영수증은 카운트하지 않는다', async () => {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;

      repository.setReceipts(userId, [
        {
          id: 'receipt-completed',
          createdAt: new Date(year, month - 1, 5).toISOString(),
          pointAmount: 250,
          status: 'completed',
          imageUrl: null,
        },
        {
          id: 'receipt-pending',
          createdAt: new Date(year, month - 1, 6).toISOString(),
          pointAmount: null,
          status: 'pending',
          imageUrl: null,
        },
        {
          id: 'receipt-rejected',
          createdAt: new Date(year, month - 1, 7).toISOString(),
          pointAmount: null,
          status: 'rejected',
          imageUrl: null,
        },
      ]);

      const result = await service.getMonthlyReceiptCount(userId);

      expect(result.count).toBe(1);
    });

    it('다른 달의 영수증은 카운트하지 않는다', async () => {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;

      repository.setReceipts(userId, [
        {
          id: 'receipt-this-month',
          createdAt: new Date(year, month - 1, 5).toISOString(),
          pointAmount: 250,
          status: 'completed',
          imageUrl: null,
        },
        {
          id: 'receipt-last-month',
          createdAt: new Date(year, month - 2, 15).toISOString(),
          pointAmount: 200,
          status: 'completed',
          imageUrl: null,
        },
      ]);

      const result = await service.getMonthlyReceiptCount(userId);

      expect(result.count).toBe(1);
    });

    it('영수증이 없으면 0을 반환한다', async () => {
      const result = await service.getMonthlyReceiptCount(userId);

      expect(result.count).toBe(0);
    });
  });

  describe('requestReReview', () => {
    it('정상적으로 재검수 요청을 생성한다', async () => {
      repository.setEveryReceiptForReReview(1, userId, {
        id: 1,
        point: 25,
        score_data: { total_score: 80 },
      });

      const result = await service.requestReReview(
        userId,
        1,
        ['store_name'],
        '매장명이 잘못되었습니다',
      );

      expect(result.success).toBe(true);
      expect(result.reReview).toBeDefined();
      expect(getInsertedReversals()).toHaveLength(1);
      expect(repository.getReReviewStatusUpdates()).toEqual([1]);
    });

    it('영수증이 없으면 NotFoundException을 던진다', async () => {
      await expect(
        service.requestReReview(userId, 999, ['store_name'], ''),
      ).rejects.toThrow('영수증을 찾을 수 없습니다.');
    });

    it('이미 재검수 요청이 있으면 BadRequestException을 던진다', async () => {
      repository.setEveryReceiptForReReview(1, userId, {
        id: 1,
        point: 25,
        score_data: null,
      });
      repository.setExistingReReview(1);

      await expect(
        service.requestReReview(userId, 1, ['store_name'], ''),
      ).rejects.toThrow('이미 재검수 요청이 존재합니다.');
    });

    it('재검수 레코드 생성 후 포인트 환수 행을 INSERT한다', async () => {
      repository.setEveryReceiptForReReview(1, userId, {
        id: 1,
        point: 30,
        score_data: { total_score: 90 },
      });

      await service.requestReReview(
        userId,
        1,
        ['items', 'date_validity'],
        '메모',
      );

      // 재검수 레코드가 먼저 생성되고
      const created = repository.getCreatedReReviews();
      expect(created).toHaveLength(1);
      expect(created[0]).toMatchObject({
        id: 1,
        everyReceiptId: 1,
        requestedItems: ['items', 'date_validity'],
        userNote: '메모',
        userId,
        beforeScoreData: { total_score: 90 },
      });

      // 반대 부호 reversal 행이 INSERT 되어야 함
      const reversals = getInsertedReversals();
      expect(reversals).toHaveLength(1);
      expect(reversals[0]).toEqual({
        userId,
        pointAmount: -30,
        everyReceiptId: 1,
        everyReceiptReReviewId: 1,
        reason: 'user_review',
      });
    });

    it('포인트가 0인 영수증은 0 금액의 reversal 행이 기록된다', async () => {
      repository.setEveryReceiptForReReview(1, userId, {
        id: 1,
        point: 0,
        score_data: { total_score: 20 },
      });

      await service.requestReReview(userId, 1, ['store_name'], '');

      const reversals = getInsertedReversals();
      expect(reversals).toHaveLength(1);
      expect(reversals[0].pointAmount).toBe(0);
      expect(reversals[0].reason).toBe('user_review');
    });

    it('userNote가 비어있으면 빈 문자열로 저장된다', async () => {
      repository.setEveryReceiptForReReview(1, userId, {
        id: 1,
        point: 10,
        score_data: null,
      });

      await service.requestReReview(userId, 1, ['items'], '');

      const created = repository.getCreatedReReviews();
      expect(created[0].userNote).toBe('');
    });
  });

  describe('getReReviewTickets', () => {
    it('재검수 기록이 없으면 5개 전부 남아있다', async () => {
      const result = await service.getReReviewTickets(userId);

      expect(result.ticketCount).toBe(5);
      expect(result.usedTickets).toBe(0);
      expect(result.totalTickets).toBe(5);
    });

    it('pending 상태의 재검수는 사용한 티켓으로 카운트한다', async () => {
      repository.setReReviewRecords(userId, [
        { id: 1, status: 'pending', created_at: new Date().toISOString() },
      ]);

      const result = await service.getReReviewTickets(userId);

      expect(result.ticketCount).toBe(4);
      expect(result.usedTickets).toBe(1);
    });

    it('rejected 상태의 재검수도 사용한 티켓으로 카운트한다', async () => {
      repository.setReReviewRecords(userId, [
        { id: 1, status: 'rejected', created_at: new Date().toISOString() },
      ]);

      const result = await service.getReReviewTickets(userId);

      expect(result.ticketCount).toBe(4);
      expect(result.usedTickets).toBe(1);
    });

    it('completed 상태의 재검수는 티켓이 반환되므로 카운트하지 않는다', async () => {
      repository.setReReviewRecords(userId, [
        { id: 1, status: 'completed', created_at: new Date().toISOString() },
      ]);

      const result = await service.getReReviewTickets(userId);

      expect(result.ticketCount).toBe(5);
      expect(result.usedTickets).toBe(0);
    });

    it('5개 모두 사용하면 ticketCount는 0이다', async () => {
      const now = new Date().toISOString();
      repository.setReReviewRecords(userId, [
        { id: 1, status: 'pending', created_at: now },
        { id: 2, status: 'pending', created_at: now },
        { id: 3, status: 'pending', created_at: now },
        { id: 4, status: 'pending', created_at: now },
        { id: 5, status: 'rejected', created_at: now },
      ]);

      const result = await service.getReReviewTickets(userId);

      expect(result.ticketCount).toBe(0);
      expect(result.usedTickets).toBe(5);
    });

    it('5개 초과 사용해도 ticketCount는 0 미만이 되지 않는다', async () => {
      const now = new Date().toISOString();
      repository.setReReviewRecords(userId, [
        { id: 1, status: 'pending', created_at: now },
        { id: 2, status: 'pending', created_at: now },
        { id: 3, status: 'pending', created_at: now },
        { id: 4, status: 'pending', created_at: now },
        { id: 5, status: 'pending', created_at: now },
        { id: 6, status: 'rejected', created_at: now },
      ]);

      const result = await service.getReReviewTickets(userId);

      expect(result.ticketCount).toBe(0);
      expect(result.usedTickets).toBe(6);
    });

    it('이번주 이전 데이터는 카운트하지 않는다', async () => {
      // 2주 전 데이터
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
      repository.setReReviewRecords(userId, [
        {
          id: 1,
          status: 'pending',
          created_at: twoWeeksAgo.toISOString(),
        },
      ]);

      const result = await service.getReReviewTickets(userId);

      expect(result.ticketCount).toBe(5);
      expect(result.usedTickets).toBe(0);
    });
  });

  describe('getCompletedCount', () => {
    it('completed 상태의 영수증 수를 반환한다', async () => {
      repository.setReceipts(userId, [
        {
          id: '1',
          createdAt: '2026-04-01T10:00:00Z',
          pointAmount: 100,
          status: 'completed',
          imageUrl: null,
        },
        {
          id: '2',
          createdAt: '2026-04-02T10:00:00Z',
          pointAmount: 50,
          status: 'completed',
          imageUrl: null,
        },
        {
          id: '3',
          createdAt: '2026-04-03T10:00:00Z',
          pointAmount: null,
          status: 'pending',
          imageUrl: null,
        },
      ]);

      const result = await service.getCompletedCount(userId);

      expect(result.count).toBe(2);
    });

    it('영수증이 없으면 0을 반환한다', async () => {
      const result = await service.getCompletedCount(userId);

      expect(result.count).toBe(0);
    });

    it('completed가 아닌 상태만 있으면 0을 반환한다', async () => {
      repository.setReceipts(userId, [
        {
          id: '1',
          createdAt: '2026-04-01T10:00:00Z',
          pointAmount: null,
          status: 'pending',
          imageUrl: null,
        },
        {
          id: '2',
          createdAt: '2026-04-02T10:00:00Z',
          pointAmount: null,
          status: 'rejected',
          imageUrl: null,
        },
      ]);

      const result = await service.getCompletedCount(userId);

      expect(result.count).toBe(0);
    });
  });

  describe('getEveryReceiptDetail', () => {
    const receiptId = 123;

    it('영수증이 없으면 NotFoundException을 던진다', async () => {
      await expect(
        service.getEveryReceiptDetail(receiptId, userId),
      ).rejects.toThrow('Receipt not found');
    });

    it('score_data가 없으면 기본 정보만 반환한다', async () => {
      repository.setDetail(receiptId, userId, {
        id: receiptId,
        createdAt: '2026-01-15T10:00:00+09:00',
        pointAmount: 25,
        status: 'completed',
        imageUrl: 'https://example.com/image.jpg',
        scoreData: null,
      });
      repository.setReReviewStatus(receiptId, 'pending');

      const result = await service.getEveryReceiptDetail(receiptId, userId);

      expect(result.id).toBe(receiptId);
      expect(result.pointAmount).toBe(25);
      expect(result.adShowPoint).toBe(0);
      expect(result.reReviewStatus).toBe('pending');
      expect(result.grade).toBeUndefined();
    });

    it('score_data가 있으면 등급 정보를 포함한다', async () => {
      repository.setDetail(receiptId, userId, {
        id: receiptId,
        createdAt: '2026-01-15T10:00:00+09:00',
        pointAmount: 30,
        status: 'completed',
        imageUrl: 'https://example.com/image.jpg',
        scoreData: makeScoreData(),
      });

      const result = await service.getEveryReceiptDetail(receiptId, userId);

      expect(result.receiptType).toBe('offline');
      expect(result.storeInfo).toBe('both');
      expect(result.paymentInfo).toBe('both');
      expect(result.hasItems).toBe(true);
      expect(result.dateValidity).toBe(5);
      expect(result.imageQuality).toBe(5);
      expect(result.storeRevisit).toBe(1);
      expect(result.isDuplicateReceipt).toBe(false);
      expect(result.totalScore).toBe(80);
      expect(result.grade).toBe('A+');
    });

    it('reReviewStatus가 없으면 null을 반환한다', async () => {
      repository.setDetail(receiptId, userId, {
        id: receiptId,
        createdAt: '2026-01-15T10:00:00+09:00',
        pointAmount: 10,
        status: 'completed',
        imageUrl: null,
        scoreData: null,
      });

      const result = await service.getEveryReceiptDetail(receiptId, userId);

      expect(result.reReviewStatus).toBeNull();
    });
  });

  describe('confirmUpload', () => {
    const publicUrl = 'https://storage.googleapis.com/bucket/user/image.jpg';

    it('영수증을 DB에 등록하고 성공 응답을 반환한다', async () => {
      const result = await service.confirmUpload(userId, publicUrl, null);

      expect(result.success).toBe(true);
      expect(result.everyReceiptId).toBe(1);
      expect(result.imageUrl).toBe(publicUrl);
    });

    it('DB에 올바른 파라미터로 insert한다', async () => {
      await service.confirmUpload(userId, publicUrl, 'POINT(127.0 37.5)');

      const inserted = repository.getInsertedReceipts();
      expect(inserted).toHaveLength(1);
      expect(inserted[0]).toEqual({
        userId,
        imageUrl: publicUrl,
        position: 'POINT(127.0 37.5)',
      });
    });

    it('position이 null이면 null로 저장한다', async () => {
      await service.confirmUpload(userId, publicUrl, null);

      const inserted = repository.getInsertedReceipts();
      expect(inserted[0].position).toBeNull();
    });

    it('PubSub에 메시지를 발행한다', async () => {
      await service.confirmUpload(userId, publicUrl, null);

      // PubSub은 fire-and-forget이므로 약간의 대기
      await new Promise((resolve) => setTimeout(resolve, 10));

      const messages = queueService.getMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual({
        imageUrl: publicUrl,
        userId,
        everyReceiptId: 1,
      });
    });

    it('PubSub 발행 실패해도 응답은 성공한다', async () => {
      queueService.setShouldFail(true);

      const result = await service.confirmUpload(userId, publicUrl, null);

      expect(result.success).toBe(true);
      expect(result.everyReceiptId).toBe(1);
    });

    it('여러 번 호출하면 각각 다른 ID를 반환한다', async () => {
      const result1 = await service.confirmUpload(userId, publicUrl, null);
      const result2 = await service.confirmUpload(
        userId,
        'https://storage.googleapis.com/bucket/user/image2.jpg',
        null,
      );

      expect(result1.everyReceiptId).toBe(1);
      expect(result2.everyReceiptId).toBe(2);
    });

    it('Amplitude에 daily_receipt_uploaded 이벤트를 전송한다', async () => {
      await service.confirmUpload(userId, publicUrl, null);

      const events = amplitudeService.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe('daily_receipt_uploaded');
      expect(events[0].userId).toBe(userId);
      expect(events[0].properties).toEqual(
        expect.objectContaining({
          everyReceiptId: 1,
        }),
      );
      expect(events[0].properties?.timestamp).toBeDefined();
    });
  });

  describe('completeReceipt', () => {
    const receiptId = 100;

    it('영수증을 찾을 수 없으면 에러를 던진다', async () => {
      await expect(service.completeReceipt(receiptId)).rejects.toThrow();
    });

    it('score_data 없는 영수증(=null)은 찾을 수 없다', async () => {
      // findPendingWithScoreData는 score_data IS NOT NULL 조건으로 조회하므로
      // score_data가 없으면 null을 반환
      await expect(service.completeReceipt(999)).rejects.toThrow();
    });

    it('정상 영수증을 completed 상태로 변경한다', async () => {
      repository.setPendingReceipt({
        id: receiptId,
        userId,
        point: 25,
        scoreData: makeScoreData(),
      });

      await service.completeReceipt(receiptId);

      const completed = repository.getCompletedReceiptIds();
      expect(completed).toContain(receiptId);
    });

    it('완료 처리 후 포인트 액션을 생성한다', async () => {
      repository.setPendingReceipt({
        id: receiptId,
        userId,
        point: 25,
        scoreData: makeScoreData(),
      });

      await service.completeReceipt(receiptId);

      const pointActions = pointWriteRepository.getInsertedActions();
      expect(pointActions).toHaveLength(1);
      expect(pointActions[0]).toMatchObject({
        userId,
        amount: 25,
        type: 'EVERY_RECEIPT',
        status: 'done',
        additionalData: { every_receipt_id: receiptId },
      });
    });

    it('중복 영수증(point=0, is_duplicate_receipt=true)은 rejected로 처리한다', async () => {
      repository.setPendingReceipt({
        id: receiptId,
        userId,
        point: 0,
        scoreData: makeScoreData({ is_duplicate_receipt: true }),
      });

      await service.completeReceipt(receiptId);

      const rejected = repository.getRejectedReceipts();
      expect(rejected).toHaveLength(1);
      expect(rejected[0]).toEqual({
        id: receiptId,
        reason: '중복된 영수증 제출',
      });

      // completed로 처리되지 않아야 함
      const completed = repository.getCompletedReceiptIds();
      expect(completed).toHaveLength(0);
    });

    it('중복 영수증은 포인트 액션을 생성하지 않는다', async () => {
      repository.setPendingReceipt({
        id: receiptId,
        userId,
        point: 0,
        scoreData: makeScoreData({ is_duplicate_receipt: true }),
      });

      await service.completeReceipt(receiptId);

      const pointActions = pointWriteRepository.getInsertedActions();
      expect(pointActions).toHaveLength(0);
    });

    it('is_duplicate_receipt가 true여도 point가 0이 아니면 정상 완료한다', async () => {
      repository.setPendingReceipt({
        id: receiptId,
        userId,
        point: 15,
        scoreData: makeScoreData({ is_duplicate_receipt: true }),
      });

      await service.completeReceipt(receiptId);

      const completed = repository.getCompletedReceiptIds();
      expect(completed).toContain(receiptId);

      const rejected = repository.getRejectedReceipts();
      expect(rejected).toHaveLength(0);
    });

    it('point가 0이어도 is_duplicate_receipt가 false이면 정상 완료한다', async () => {
      repository.setPendingReceipt({
        id: receiptId,
        userId,
        point: 0,
        scoreData: makeScoreData({ is_duplicate_receipt: false }),
      });

      await service.completeReceipt(receiptId);

      const completed = repository.getCompletedReceiptIds();
      expect(completed).toContain(receiptId);

      const rejected = repository.getRejectedReceipts();
      expect(rejected).toHaveLength(0);
    });

    it('온보딩 이벤트 기간 + 첫 번째 영수증이면 포인트를 2배로 업데이트한다', async () => {
      onboardingService.setEventStatus(true);
      repository.setFirstReceiptId(userId, receiptId);

      repository.setPendingReceipt({
        id: receiptId,
        userId,
        point: 25,
        scoreData: makeScoreData(),
      });

      await service.completeReceipt(receiptId);

      const pointUpdates = repository.getPointUpdates();
      expect(pointUpdates).toHaveLength(1);
      expect(pointUpdates[0]).toEqual({ id: receiptId, point: 50 });
    });

    it('온보딩 이벤트 기간이지만 첫 번째 영수증이 아니면 2배 적용하지 않는다', async () => {
      onboardingService.setEventStatus(true);
      repository.setFirstReceiptId(userId, 999); // 다른 영수증이 첫 번째

      repository.setPendingReceipt({
        id: receiptId,
        userId,
        point: 25,
        scoreData: makeScoreData(),
      });

      await service.completeReceipt(receiptId);

      const pointUpdates = repository.getPointUpdates();
      expect(pointUpdates).toHaveLength(0);
    });

    it('더블 포인트 이벤트 기간이면 포인트를 2배로 업데이트한다', async () => {
      eventService.setDoublePointActive(true);

      repository.setPendingReceipt({
        id: receiptId,
        userId,
        point: 30,
        scoreData: makeScoreData(),
      });

      await service.completeReceipt(receiptId);

      const pointUpdates = repository.getPointUpdates();
      expect(pointUpdates).toHaveLength(1);
      expect(pointUpdates[0]).toEqual({ id: receiptId, point: 60 });
    });

    it('온보딩 + 더블 포인트 둘 다 해당해도 2배만 적용한다 (4배 아님)', async () => {
      onboardingService.setEventStatus(true);
      repository.setFirstReceiptId(userId, receiptId);
      eventService.setDoublePointActive(true);

      repository.setPendingReceipt({
        id: receiptId,
        userId,
        point: 20,
        scoreData: makeScoreData(),
      });

      await service.completeReceipt(receiptId);

      const pointUpdates = repository.getPointUpdates();
      expect(pointUpdates).toHaveLength(1);
      expect(pointUpdates[0]).toEqual({ id: receiptId, point: 40 });
    });

    it('이벤트 비활성 시 포인트를 업데이트하지 않는다', async () => {
      repository.setPendingReceipt({
        id: receiptId,
        userId,
        point: 25,
        scoreData: makeScoreData(),
      });

      await service.completeReceipt(receiptId);

      const pointUpdates = repository.getPointUpdates();
      expect(pointUpdates).toHaveLength(0);
    });

    it('2배 적용 후 포인트 액션도 2배 포인트로 생성한다', async () => {
      eventService.setDoublePointActive(true);

      repository.setPendingReceipt({
        id: receiptId,
        userId,
        point: 25,
        scoreData: makeScoreData(),
      });

      await service.completeReceipt(receiptId);

      const pointActions = pointWriteRepository.getInsertedActions();
      expect(pointActions).toHaveLength(1);
      expect(pointActions[0].amount).toBe(50);
    });

    it('완료 후 FCM 푸시 알림을 전송한다', async () => {
      repository.setPendingReceipt({
        id: receiptId,
        userId,
        point: 25,
        scoreData: makeScoreData(),
      });

      await service.completeReceipt(receiptId);

      const notifications = fcmService.getPushNotifications();
      expect(notifications).toHaveLength(1);
      expect(notifications[0].userId).toBe(userId);
    });

    it('완료 후 receipt_update 리프레시 메시지를 전송한다', async () => {
      repository.setPendingReceipt({
        id: receiptId,
        userId,
        point: 25,
        scoreData: makeScoreData(),
      });

      await service.completeReceipt(receiptId);

      const refreshMessages = fcmService.getRefreshMessages();
      expect(refreshMessages).toHaveLength(1);
      expect(refreshMessages[0]).toEqual({
        userId,
        type: 'receipt_update',
      });
    });

    it('중복 reject 후에도 receipt_update 리프레시 메시지를 전송한다', async () => {
      repository.setPendingReceipt({
        id: receiptId,
        userId,
        point: 0,
        scoreData: makeScoreData({ is_duplicate_receipt: true }),
      });

      await service.completeReceipt(receiptId);

      const refreshMessages = fcmService.getRefreshMessages();
      expect(refreshMessages).toHaveLength(1);
      expect(refreshMessages[0]).toEqual({
        userId,
        type: 'receipt_update',
      });
    });

    it('중복 reject 시 포인트 푸시 알림은 보내지 않는다', async () => {
      repository.setPendingReceipt({
        id: receiptId,
        userId,
        point: 0,
        scoreData: makeScoreData({ is_duplicate_receipt: true }),
      });

      await service.completeReceipt(receiptId);

      const notifications = fcmService.getPushNotifications();
      expect(notifications).toHaveLength(0);
    });

    it('성공 응답을 반환한다', async () => {
      repository.setPendingReceipt({
        id: receiptId,
        userId,
        point: 25,
        scoreData: makeScoreData(),
      });

      const result = await service.completeReceipt(receiptId);

      expect(result).toEqual({ success: true });
    });

    it('중복 reject에도 성공 응답을 반환한다', async () => {
      repository.setPendingReceipt({
        id: receiptId,
        userId,
        point: 0,
        scoreData: makeScoreData({ is_duplicate_receipt: true }),
      });

      const result = await service.completeReceipt(receiptId);

      expect(result).toEqual({ success: true });
    });

    it('푸시 알림이 웹앱과 동일한 포맷으로 전송된다', async () => {
      repository.setPendingReceipt({
        id: receiptId,
        userId,
        point: 25,
        scoreData: makeScoreData(),
      });

      await service.completeReceipt(receiptId);

      const notifications = fcmService.getPushNotifications();
      expect(notifications[0].title).toBe('AI 영수증 분석이 완료됐어요 🤖');
      expect(notifications[0].body).toBe('바로 25포인트를 지급할게요!');
    });

    it('2배 적용된 영수증의 푸시 알림에 2배 포인트가 포함된다', async () => {
      eventService.setDoublePointActive(true);

      repository.setPendingReceipt({
        id: receiptId,
        userId,
        point: 25,
        scoreData: makeScoreData(),
      });

      await service.completeReceipt(receiptId);

      const notifications = fcmService.getPushNotifications();
      expect(notifications).toHaveLength(1);
      expect(notifications[0].body).toBe('바로 50포인트를 지급할게요!');
    });

    it('포인트가 0인 정상 완료 시 알림 body가 다르다', async () => {
      repository.setPendingReceipt({
        id: receiptId,
        userId,
        point: 0,
        scoreData: makeScoreData({ is_duplicate_receipt: false }),
      });

      await service.completeReceipt(receiptId);

      const notifications = fcmService.getPushNotifications();
      expect(notifications[0].body).toBe('아쉽지만 포인트를 지급할 수 없어요');
    });
  });

  // ===========================================================================
  // Admin
  // ===========================================================================

  describe('adminDeleteReceipt', () => {
    it('존재하지 않는 영수증이면 NotFoundException을 던진다', async () => {
      await expect(service.adminDeleteReceipt(999)).rejects.toThrow(
        '영수증을 찾을 수 없습니다.',
      );
    });

    it('completed 상태 영수증은 reversal 행을 추가하고 삭제한다', async () => {
      repository.setAdminReceipt({
        id: 1,
        user_id: userId,
        status: 'completed',
        point: 25,
      });

      const result = await service.adminDeleteReceipt(1);

      expect(result.success).toBe(true);
      expect(result.message).toBe('영수증이 삭제되었습니다.');

      const reversals = getInsertedReversals();
      expect(reversals).toHaveLength(1);
      expect(reversals[0]).toEqual({
        userId,
        pointAmount: -25,
        everyReceiptId: 1,
        reason: 'admin_delete',
        beforePoint: 25,
        afterPoint: 0,
      });

      expect(repository.getDeletedReceiptIds()).toEqual([1]);
    });

    it('pending 상태 영수증은 reversal 없이 삭제만 한다', async () => {
      repository.setAdminReceipt({
        id: 2,
        user_id: userId,
        status: 'pending',
        point: 0,
      });

      await service.adminDeleteReceipt(2);

      expect(getInsertedReversals()).toHaveLength(0);
      expect(repository.getDeletedReceiptIds()).toEqual([2]);
    });

    it('rejected 상태 영수증은 reversal 없이 삭제만 한다', async () => {
      repository.setAdminReceipt({
        id: 3,
        user_id: userId,
        status: 'rejected',
        point: 0,
      });

      await service.adminDeleteReceipt(3);

      expect(getInsertedReversals()).toHaveLength(0);
      expect(repository.getDeletedReceiptIds()).toEqual([3]);
    });

    it('completed 이더라도 point=0이면 reversal은 생략한다', async () => {
      repository.setAdminReceipt({
        id: 4,
        user_id: userId,
        status: 'completed',
        point: 0,
      });

      await service.adminDeleteReceipt(4);

      expect(getInsertedReversals()).toHaveLength(0);
      expect(repository.getDeletedReceiptIds()).toEqual([4]);
    });
  });

  describe('adminUpdatePoint', () => {
    it('존재하지 않는 영수증이면 NotFoundException을 던진다', async () => {
      await expect(service.adminUpdatePoint(999, 10)).rejects.toThrow(
        '영수증을 찾을 수 없습니다.',
      );
    });

    it('completed 상태에서 포인트를 올리면 +delta reversal 행이 기록된다', async () => {
      repository.setAdminReceipt({
        id: 10,
        user_id: userId,
        status: 'completed',
        point: 5,
      });

      await service.adminUpdatePoint(10, 8);

      expect(repository.getReceiptPointUpdates()).toEqual([
        { receiptId: 10, newPoint: 8 },
      ]);

      const reversals = getInsertedReversals();
      expect(reversals).toHaveLength(1);
      expect(reversals[0]).toEqual({
        userId,
        pointAmount: 3,
        everyReceiptId: 10,
        reason: 'admin_adjust',
        beforePoint: 5,
        afterPoint: 8,
      });
    });

    it('completed 상태에서 포인트를 낮추면 -delta reversal 행이 기록된다', async () => {
      repository.setAdminReceipt({
        id: 11,
        user_id: userId,
        status: 'completed',
        point: 10,
      });

      await service.adminUpdatePoint(11, 4);

      const reversals = getInsertedReversals();
      expect(reversals).toHaveLength(1);
      expect(reversals[0].pointAmount).toBe(-6);
      expect(reversals[0].beforePoint).toBe(10);
      expect(reversals[0].afterPoint).toBe(4);
    });

    it('delta=0 이면 reversal 행은 생략한다', async () => {
      repository.setAdminReceipt({
        id: 12,
        user_id: userId,
        status: 'completed',
        point: 15,
      });

      await service.adminUpdatePoint(12, 15);

      expect(repository.getReceiptPointUpdates()).toEqual([
        { receiptId: 12, newPoint: 15 },
      ]);
      expect(getInsertedReversals()).toHaveLength(0);
    });

    it('completed가 아닌 상태에선 point만 업데이트하고 reversal은 생략한다', async () => {
      repository.setAdminReceipt({
        id: 13,
        user_id: userId,
        status: 'pending',
        point: 0,
      });

      await service.adminUpdatePoint(13, 25);

      expect(repository.getReceiptPointUpdates()).toEqual([
        { receiptId: 13, newPoint: 25 },
      ]);
      expect(getInsertedReversals()).toHaveLength(0);
    });
  });

  describe('adminCompleteReReview', () => {
    const afterScoreData = { items: { score: 15, reason: 'better' } };

    it('재검수 요청이 없으면 NotFoundException을 던진다', async () => {
      await expect(
        service.adminCompleteReReview({
          everyReceiptId: 999,
          afterScoreData,
          afterPoint: 30,
          afterTotalScore: 85,
        }),
      ).rejects.toThrow('재검수 요청을 찾을 수 없습니다.');
    });

    it('이미 처리된 재검수 요청은 BadRequestException을 던진다', async () => {
      repository.setAdminReReview({
        id: 50,
        every_receipt_id: 20,
        status: 'completed',
      });

      await expect(
        service.adminCompleteReReview({
          everyReceiptId: 20,
          afterScoreData,
          afterPoint: 30,
          afterTotalScore: 85,
        }),
      ).rejects.toThrow('이미 처리된 재검수 요청입니다.');
    });

    it('영수증이 없으면 NotFoundException을 던진다', async () => {
      repository.setAdminReReview({
        id: 51,
        every_receipt_id: 21,
        status: 'pending',
      });
      // receipt 미설정

      await expect(
        service.adminCompleteReReview({
          everyReceiptId: 21,
          afterScoreData,
          afterPoint: 30,
          afterTotalScore: 85,
        }),
      ).rejects.toThrow('영수증을 찾을 수 없습니다.');
    });

    describe('분기 A: afterPoint <= beforePoint (점수 유지/하락)', () => {
      it('beforePoint를 재지급 행으로 기록한다', async () => {
        repository.setAdminReReview({
          id: 100,
          every_receipt_id: 30,
          status: 'pending',
        });
        repository.setAdminReceipt({
          id: 30,
          user_id: userId,
          status: 're-review',
          point: 15,
        });

        const result = await service.adminCompleteReReview({
          everyReceiptId: 30,
          afterScoreData,
          afterPoint: 12, // 하락
          afterTotalScore: 70,
        });

        expect(result.success).toBe(true);
        expect(result.message).toBe('재검수 포인트가 변경되지 않았습니다.');

        expect(repository.getReReviewRejected()).toEqual([100]);
        expect(repository.getReceiptStatusCompletedUpdates()).toEqual([30]);

        const reversals = getInsertedReversals();
        expect(reversals).toHaveLength(1);
        expect(reversals[0]).toEqual({
          userId,
          pointAmount: 15, // 원래 포인트 재지급
          everyReceiptId: 30,
          everyReceiptReReviewId: 100,
          reason: 're_review_rejected',
        });

        expect(userModalService.getCreatedModals()).toHaveLength(1);
        expect(fcmService.getRefreshMessages()).toEqual([
          { userId, type: 'receipt_update' },
        ]);
      });

      it('afterPoint === beforePoint 경계값도 분기 A로 진입한다', async () => {
        repository.setAdminReReview({
          id: 101,
          every_receipt_id: 31,
          status: 'pending',
        });
        repository.setAdminReceipt({
          id: 31,
          user_id: userId,
          status: 're-review',
          point: 20,
        });

        const result = await service.adminCompleteReReview({
          everyReceiptId: 31,
          afterScoreData,
          afterPoint: 20,
          afterTotalScore: 80,
        });

        expect(result.message).toBe('재검수 포인트가 변경되지 않았습니다.');
        expect(repository.getReReviewRejected()).toEqual([101]);
      });

      it('beforePoint가 0이면 재지급 행도 생략한다', async () => {
        repository.setAdminReReview({
          id: 102,
          every_receipt_id: 32,
          status: 'pending',
        });
        repository.setAdminReceipt({
          id: 32,
          user_id: userId,
          status: 're-review',
          point: 0,
        });

        await service.adminCompleteReReview({
          everyReceiptId: 32,
          afterScoreData,
          afterPoint: 0,
          afterTotalScore: 50,
        });

        expect(getInsertedReversals()).toHaveLength(0);
        expect(repository.getReReviewRejected()).toEqual([102]);
      });
    });

    describe('분기 B: afterPoint > beforePoint (점수 상승)', () => {
      it('afterPoint 지급 행 + 상태 업데이트 + 알림', async () => {
        repository.setAdminReReview({
          id: 200,
          every_receipt_id: 40,
          status: 'pending',
        });
        repository.setAdminReceipt({
          id: 40,
          user_id: userId,
          status: 're-review',
          point: 10,
        });

        const result = await service.adminCompleteReReview({
          everyReceiptId: 40,
          afterScoreData,
          afterPoint: 25,
          afterTotalScore: 85,
        });

        expect(result.success).toBe(true);
        expect(result.message).toBeUndefined();

        expect(repository.getReReviewCompleted()).toEqual([
          { reReviewId: 200, afterScoreData },
        ]);

        const receiptUpdates = repository.getReceiptAfterReReviewUpdates();
        expect(receiptUpdates).toHaveLength(1);
        expect(receiptUpdates[0]).toEqual({
          receiptId: 40,
          afterScoreData: { ...afterScoreData, total_score: 85 },
          afterPoint: 25,
        });

        const reversals = getInsertedReversals();
        expect(reversals).toHaveLength(1);
        expect(reversals[0]).toEqual({
          userId,
          pointAmount: 25,
          everyReceiptId: 40,
          everyReceiptReReviewId: 200,
          reason: 're_review_approved',
        });

        expect(userModalService.getCreatedModals()).toHaveLength(1);
        const modal = userModalService.getCreatedModals()[0];
        expect(modal.name).toBe('every_receipt_re_reviewed');
        expect(modal.additionalData).toMatchObject({
          everyReceiptId: 40,
          beforePoint: 10,
          afterPoint: 25,
        });

        expect(fcmService.getPushNotifications()).toHaveLength(1);
        expect(fcmService.getPushNotifications()[0].title).toBe(
          '영수증 재검수 완료 💌',
        );
      });
    });
  });
});
