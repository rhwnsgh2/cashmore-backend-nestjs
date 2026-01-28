import { Test, TestingModule } from '@nestjs/testing';
import { EveryReceiptService } from './every-receipt.service';
import { EVERY_RECEIPT_REPOSITORY } from './interfaces/every-receipt-repository.interface';
import { StubEveryReceiptRepository } from './repositories/stub-every-receipt.repository';

describe('EveryReceiptService', () => {
  let service: EveryReceiptService;
  let repository: StubEveryReceiptRepository;

  const userId = 'test-user-id';

  beforeEach(async () => {
    repository = new StubEveryReceiptRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EveryReceiptService,
        { provide: EVERY_RECEIPT_REPOSITORY, useValue: repository },
      ],
    }).compile();

    service = module.get<EveryReceiptService>(EveryReceiptService);
  });

  afterEach(() => {
    repository.clear();
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
});
