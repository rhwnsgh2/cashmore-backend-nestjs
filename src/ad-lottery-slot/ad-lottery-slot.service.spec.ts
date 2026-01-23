import { describe, it, expect, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { AdLotterySlotService } from './ad-lottery-slot.service';
import { AD_LOTTERY_SLOT_REPOSITORY } from './interfaces/ad-lottery-slot-repository.interface';
import { StubAdLotterySlotRepository } from './repositories/stub-ad-lottery-slot.repository';

dayjs.extend(utc);
dayjs.extend(timezone);

describe('AdLotterySlotService', () => {
  let service: AdLotterySlotService;
  let repository: StubAdLotterySlotRepository;

  beforeEach(async () => {
    repository = new StubAdLotterySlotRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdLotterySlotService,
        {
          provide: AD_LOTTERY_SLOT_REPOSITORY,
          useValue: repository,
        },
      ],
    }).compile();

    service = module.get<AdLotterySlotService>(AdLotterySlotService);
  });

  describe('getCurrentSlotTimeRange', () => {
    it('09:00 ~ 12:59 사이에는 09:00 슬롯을 반환한다', () => {
      const times = [
        dayjs.tz('2026-01-23 09:00:00', 'Asia/Seoul'),
        dayjs.tz('2026-01-23 10:30:00', 'Asia/Seoul'),
        dayjs.tz('2026-01-23 12:59:59', 'Asia/Seoul'),
      ];

      for (const time of times) {
        const result = service.getCurrentSlotTimeRange(time);
        expect(result.slot).toBe('09:00');
      }
    });

    it('13:00 ~ 17:59 사이에는 13:00 슬롯을 반환한다', () => {
      const times = [
        dayjs.tz('2026-01-23 13:00:00', 'Asia/Seoul'),
        dayjs.tz('2026-01-23 15:30:00', 'Asia/Seoul'),
        dayjs.tz('2026-01-23 17:59:59', 'Asia/Seoul'),
      ];

      for (const time of times) {
        const result = service.getCurrentSlotTimeRange(time);
        expect(result.slot).toBe('13:00');
      }
    });

    it('18:00 ~ 21:59 사이에는 18:00 슬롯을 반환한다', () => {
      const times = [
        dayjs.tz('2026-01-23 18:00:00', 'Asia/Seoul'),
        dayjs.tz('2026-01-23 20:30:00', 'Asia/Seoul'),
        dayjs.tz('2026-01-23 21:59:59', 'Asia/Seoul'),
      ];

      for (const time of times) {
        const result = service.getCurrentSlotTimeRange(time);
        expect(result.slot).toBe('18:00');
      }
    });

    it('22:00 ~ 23:59 사이에는 22:00 슬롯을 반환한다', () => {
      const times = [
        dayjs.tz('2026-01-23 22:00:00', 'Asia/Seoul'),
        dayjs.tz('2026-01-23 23:30:00', 'Asia/Seoul'),
        dayjs.tz('2026-01-23 23:59:59', 'Asia/Seoul'),
      ];

      for (const time of times) {
        const result = service.getCurrentSlotTimeRange(time);
        expect(result.slot).toBe('22:00');
      }
    });

    it('00:00 ~ 08:59 사이에는 22:00 슬롯을 반환한다 (전날 22시 슬롯)', () => {
      const times = [
        dayjs.tz('2026-01-23 00:00:00', 'Asia/Seoul'),
        dayjs.tz('2026-01-23 05:30:00', 'Asia/Seoul'),
        dayjs.tz('2026-01-23 08:59:59', 'Asia/Seoul'),
      ];

      for (const time of times) {
        const result = service.getCurrentSlotTimeRange(time);
        expect(result.slot).toBe('22:00');
      }
    });

    it('슬롯 시간 범위에 올바른 startTime과 endTime을 반환한다', () => {
      const time = dayjs.tz('2026-01-23 10:30:00', 'Asia/Seoul');
      const result = service.getCurrentSlotTimeRange(time);

      expect(result.slot).toBe('09:00');
      // startTime은 09:00, endTime은 13:00
      expect(dayjs(result.startTime).tz('Asia/Seoul').hour()).toBe(9);
      expect(dayjs(result.endTime).tz('Asia/Seoul').hour()).toBe(13);
    });
  });

  describe('getNextSlot', () => {
    it('09:00 슬롯의 다음은 13:00이다', () => {
      const time = dayjs.tz('2026-01-23 10:00:00', 'Asia/Seoul');
      const result = service.getNextSlot('09:00', time);

      expect(result.slot).toBe('13:00');
      expect(dayjs(result.time).tz('Asia/Seoul').hour()).toBe(13);
    });

    it('13:00 슬롯의 다음은 18:00이다', () => {
      const time = dayjs.tz('2026-01-23 15:00:00', 'Asia/Seoul');
      const result = service.getNextSlot('13:00', time);

      expect(result.slot).toBe('18:00');
      expect(dayjs(result.time).tz('Asia/Seoul').hour()).toBe(18);
    });

    it('18:00 슬롯의 다음은 22:00이다', () => {
      const time = dayjs.tz('2026-01-23 19:00:00', 'Asia/Seoul');
      const result = service.getNextSlot('18:00', time);

      expect(result.slot).toBe('22:00');
      expect(dayjs(result.time).tz('Asia/Seoul').hour()).toBe(22);
    });

    it('22:00 슬롯의 다음은 다음날 09:00이다', () => {
      const time = dayjs.tz('2026-01-23 23:00:00', 'Asia/Seoul');
      const result = service.getNextSlot('22:00', time);

      expect(result.slot).toBe('09:00');
      const nextTime = dayjs(result.time).tz('Asia/Seoul');
      expect(nextTime.hour()).toBe(9);
      expect(nextTime.date()).toBe(24); // 다음날
    });
  });

  describe('checkAvailability', () => {
    const userId = 'test-user-id';

    beforeEach(() => {
      repository.clear();
    });

    it('슬롯에서 시청하지 않았으면 available: true를 반환한다', async () => {
      const result = await service.checkAvailability(userId);

      expect(result.available).toBe(true);
      expect(result.nextSlot).toBeUndefined();
      expect(result.nextSlotTime).toBeUndefined();
      expect(result.message).toContain('시청할 수 있습니다');
    });

    it('슬롯에서 이미 시청했으면 available: false를 반환한다', async () => {
      // 현재 슬롯에서 시청한 기록 추가
      const currentSlotRange = service.getCurrentSlotTimeRange();

      repository.addSlot({
        id: 'slot-1',
        user_id: userId,
        slot_time: currentSlotRange.slot,
        created_at: dayjs().toISOString(),
      });

      const result = await service.checkAvailability(userId);

      expect(result.available).toBe(false);
      expect(result.nextSlot).toBeDefined();
      expect(result.nextSlotTime).toBeDefined();
      expect(result.message).toContain('다음 슬롯은');
    });

    it('다른 슬롯에서 시청한 기록은 영향을 주지 않는다', async () => {
      const currentSlotRange = service.getCurrentSlotTimeRange();

      // 다른 슬롯 시간 찾기
      const otherSlot =
        currentSlotRange.slot === '09:00' ? '13:00' : '09:00';

      repository.addSlot({
        id: 'slot-1',
        user_id: userId,
        slot_time: otherSlot,
        created_at: dayjs().toISOString(),
      });

      const result = await service.checkAvailability(userId);

      expect(result.available).toBe(true);
    });

    it('다른 사용자의 시청 기록은 영향을 주지 않는다', async () => {
      const currentSlotRange = service.getCurrentSlotTimeRange();

      repository.addSlot({
        id: 'slot-1',
        user_id: 'other-user-id',
        slot_time: currentSlotRange.slot,
        created_at: dayjs().toISOString(),
      });

      const result = await service.checkAvailability(userId);

      expect(result.available).toBe(true);
    });

    it('응답에 currentSlot이 포함된다', async () => {
      const result = await service.checkAvailability(userId);

      expect(result.currentSlot).toBeDefined();
      expect(['09:00', '13:00', '18:00', '22:00']).toContain(result.currentSlot);
    });
  });
});
