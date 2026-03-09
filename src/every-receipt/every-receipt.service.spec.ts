import { Test, TestingModule } from '@nestjs/testing';
import { EveryReceiptService } from './every-receipt.service';
import { EVERY_RECEIPT_REPOSITORY } from './interfaces/every-receipt-repository.interface';
import { StubEveryReceiptRepository } from './repositories/stub-every-receipt.repository';
import type { ReceiptQueueMessage } from './receipt-queue.service';
import { ReceiptQueueService } from './receipt-queue.service';
import type { AmplitudeEventProperties } from '../amplitude/amplitude.service';
import { AmplitudeService } from '../amplitude/amplitude.service';

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

describe('EveryReceiptService', () => {
  let service: EveryReceiptService;
  let repository: StubEveryReceiptRepository;
  let queueService: StubReceiptQueueService;
  let amplitudeService: StubAmplitudeService;

  const userId = 'test-user-id';

  beforeEach(async () => {
    repository = new StubEveryReceiptRepository();
    queueService = new StubReceiptQueueService();
    amplitudeService = new StubAmplitudeService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EveryReceiptService,
        { provide: EVERY_RECEIPT_REPOSITORY, useValue: repository },
        { provide: ReceiptQueueService, useValue: queueService },
        { provide: AmplitudeService, useValue: amplitudeService },
      ],
    }).compile();

    service = module.get<EveryReceiptService>(EveryReceiptService);
  });

  afterEach(() => {
    repository.clear();
    queueService.clear();
    amplitudeService.clear();
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
        scoreData: {
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
        },
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
});
