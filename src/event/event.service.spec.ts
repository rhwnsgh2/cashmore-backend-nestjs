import { Test, TestingModule } from '@nestjs/testing';
import { EventService } from './event.service';
import { SupabaseService } from '../supabase/supabase.service';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

describe('EventService', () => {
  let service: EventService;
  let mockSupabaseService: {
    getClient: jest.fn;
  };
  let mockSingle: jest.Mock;

  beforeEach(async () => {
    mockSingle = jest.fn();
    const mockSelect = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        single: mockSingle,
      }),
    });
    mockSupabaseService = {
      getClient: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          select: mockSelect,
        }),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventService,
        { provide: SupabaseService, useValue: mockSupabaseService },
      ],
    }).compile();

    service = module.get<EventService>(EventService);
  });

  describe('isDoublePointActive', () => {
    it('가입 다음날이면 true를 반환해야 한다', async () => {
      const yesterday = dayjs()
        .tz('Asia/Seoul')
        .subtract(1, 'day')
        .hour(12)
        .toISOString();
      mockSingle.mockResolvedValue({
        data: { created_at: yesterday },
        error: null,
      });

      const result = await service.isDoublePointActive('user-1');
      expect(result).toBe(true);
    });

    it('가입 당일이면 false를 반환해야 한다', async () => {
      const today = dayjs().tz('Asia/Seoul').hour(12).toISOString();
      mockSingle.mockResolvedValue({
        data: { created_at: today },
        error: null,
      });

      const result = await service.isDoublePointActive('user-1');
      expect(result).toBe(false);
    });

    it('가입 2일 이후면 false를 반환해야 한다', async () => {
      const twoDaysAgo = dayjs()
        .tz('Asia/Seoul')
        .subtract(2, 'day')
        .hour(12)
        .toISOString();
      mockSingle.mockResolvedValue({
        data: { created_at: twoDaysAgo },
        error: null,
      });

      const result = await service.isDoublePointActive('user-1');
      expect(result).toBe(false);
    });

    it('가입 다음날 00:00:01이면 true를 반환해야 한다 (이벤트 시작 직후)', async () => {
      const now = dayjs().tz('Asia/Seoul');
      // 가입일을 "어제의 전날"로 설정하면, 이벤트 기간은 "어제 00:00~23:59"
      // 대신 현재 시각이 이벤트 기간 안에 들도록 가입일을 어제로 설정
      const joinDate = now.subtract(1, 'day').startOf('day').add(1, 'second');
      mockSingle.mockResolvedValue({
        data: { created_at: joinDate.toISOString() },
        error: null,
      });

      const result = await service.isDoublePointActive('user-1');
      expect(result).toBe(true);
    });

    it('가입 다음날 23:59:58이면 true를 반환해야 한다 (이벤트 종료 직전)', async () => {
      const now = dayjs().tz('Asia/Seoul');
      // 가입일을 현재 시각 기준 정확히 하루 전으로 설정
      const joinDate = now.subtract(1, 'day');
      mockSingle.mockResolvedValue({
        data: { created_at: joinDate.toISOString() },
        error: null,
      });

      const result = await service.isDoublePointActive('user-1');
      expect(result).toBe(true);
    });

    it('가입 당일 23:59:59이면 false를 반환해야 한다 (이벤트 시작 전)', async () => {
      const now = dayjs().tz('Asia/Seoul');
      // 가입일을 오늘로 설정 → 이벤트는 내일이므로 false
      const joinDate = now.startOf('day').add(1, 'second');
      mockSingle.mockResolvedValue({
        data: { created_at: joinDate.toISOString() },
        error: null,
      });

      const result = await service.isDoublePointActive('user-1');
      expect(result).toBe(false);
    });

    it('가입 2일째 00:00 이후면 false를 반환해야 한다 (이벤트 종료 후)', async () => {
      const now = dayjs().tz('Asia/Seoul');
      // 가입일을 2일 전으로 설정 → 이벤트 기간(어제)이 이미 지남
      const joinDate = now.subtract(2, 'day').hour(12);
      mockSingle.mockResolvedValue({
        data: { created_at: joinDate.toISOString() },
        error: null,
      });

      const result = await service.isDoublePointActive('user-1');
      expect(result).toBe(false);
    });

    it('가입 7일 이후면 false를 반환해야 한다', async () => {
      const weekAgo = dayjs()
        .tz('Asia/Seoul')
        .subtract(7, 'day')
        .hour(12)
        .toISOString();
      mockSingle.mockResolvedValue({
        data: { created_at: weekAgo },
        error: null,
      });

      const result = await service.isDoublePointActive('user-1');
      expect(result).toBe(false);
    });

    it('유저 조회 실패 시 false를 반환해야 한다', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: 'not found' },
      });

      const result = await service.isDoublePointActive('user-1');
      expect(result).toBe(false);
    });

    it('유저 데이터가 null이면 false를 반환해야 한다', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: null,
      });

      const result = await service.isDoublePointActive('user-1');
      expect(result).toBe(false);
    });
  });
});
