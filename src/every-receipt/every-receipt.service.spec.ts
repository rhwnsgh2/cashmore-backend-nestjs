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

      expect(result).toEqual({
        receipts: [],
      });
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

      expect(result.receipts).toHaveLength(2);
      expect(result.receipts[0].id).toBe('receipt-1');
      expect(result.receipts[1].id).toBe('receipt-2');
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

      expect(result.receipts[0].id).toBe('receipt-new');
      expect(result.receipts[1].id).toBe('receipt-old');
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

      expect(result.receipts).toHaveLength(1);
      expect(result.receipts[0].status).toBe('pending');
      expect(result.receipts[0].pointAmount).toBeNull();
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

      expect(result.receipts).toHaveLength(1);
      expect(result.receipts[0].status).toBe('rejected');
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

      expect(result.receipts).toHaveLength(1);
      expect(result.receipts[0].id).toBe('my-receipt');
    });
  });
});
