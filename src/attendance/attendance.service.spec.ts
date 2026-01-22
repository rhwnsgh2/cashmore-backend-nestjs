import { Test, TestingModule } from '@nestjs/testing';
import { AttendanceService } from './attendance.service';
import { ATTENDANCE_REPOSITORY } from './interfaces/attendance-repository.interface';
import { StubAttendanceRepository } from './repositories/stub-attendance.repository';

describe('AttendanceService', () => {
  let service: AttendanceService;
  let repository: StubAttendanceRepository;

  const userId = 'test-user-id';

  beforeEach(async () => {
    repository = new StubAttendanceRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceService,
        { provide: ATTENDANCE_REPOSITORY, useValue: repository },
      ],
    }).compile();

    service = module.get<AttendanceService>(AttendanceService);
  });

  afterEach(() => {
    repository.clear();
  });

  describe('getAttendances', () => {
    it('출석 기록이 없으면 빈 배열을 반환한다', async () => {
      const result = await service.getAttendances(userId);

      expect(result).toEqual([]);
    });

    it('출석 기록을 반환한다', async () => {
      repository.setAttendances(userId, [
        {
          id: 1,
          userId,
          createdAtDate: '2026-01-15',
          createdAt: '2026-01-15T09:00:00+09:00',
        },
        {
          id: 2,
          userId,
          createdAtDate: '2026-01-16',
          createdAt: '2026-01-16T09:30:00+09:00',
        },
      ]);

      const result = await service.getAttendances(userId);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(1);
      expect(result[0].attendanceDate).toBe('2026-01-15');
      expect(result[1].id).toBe(2);
      expect(result[1].attendanceDate).toBe('2026-01-16');
    });

    it('출석 포인트를 올바르게 매핑한다', async () => {
      repository.setAttendances(userId, [
        {
          id: 1,
          userId,
          createdAtDate: '2026-01-15',
          createdAt: '2026-01-15T09:00:00+09:00',
        },
      ]);

      repository.setPointActions(userId, [
        {
          id: 100,
          createdAt: '2026-01-15T09:00:01+09:00',
          pointAmount: 100,
          additionalData: { attendance_id: 1 },
          type: 'ATTENDANCE',
        },
      ]);

      const result = await service.getAttendances(userId);

      expect(result).toHaveLength(1);
      expect(result[0].point).toBe(100);
      expect(result[0].adShowPoint).toBeNull();
    });

    it('광고 시청 포인트를 올바르게 매핑한다', async () => {
      repository.setAttendances(userId, [
        {
          id: 1,
          userId,
          createdAtDate: '2026-01-15',
          createdAt: '2026-01-15T09:00:00+09:00',
        },
      ]);

      repository.setPointActions(userId, [
        {
          id: 101,
          createdAt: '2026-01-15T09:00:05+09:00',
          pointAmount: 50,
          additionalData: { attendance_id: 1 },
          type: 'ATTENDANCE_AD',
        },
      ]);

      const result = await service.getAttendances(userId);

      expect(result).toHaveLength(1);
      expect(result[0].point).toBeNull();
      expect(result[0].adShowPoint).toBe(50);
    });

    it('출석 포인트와 광고 포인트를 모두 매핑한다', async () => {
      repository.setAttendances(userId, [
        {
          id: 1,
          userId,
          createdAtDate: '2026-01-15',
          createdAt: '2026-01-15T09:00:00+09:00',
        },
      ]);

      repository.setPointActions(userId, [
        {
          id: 100,
          createdAt: '2026-01-15T09:00:01+09:00',
          pointAmount: 100,
          additionalData: { attendance_id: 1 },
          type: 'ATTENDANCE',
        },
        {
          id: 101,
          createdAt: '2026-01-15T09:00:05+09:00',
          pointAmount: 50,
          additionalData: { attendance_id: 1 },
          type: 'ATTENDANCE_AD',
        },
      ]);

      const result = await service.getAttendances(userId);

      expect(result).toHaveLength(1);
      expect(result[0].point).toBe(100);
      expect(result[0].adShowPoint).toBe(50);
    });

    it('여러 출석 기록의 포인트를 각각 올바르게 매핑한다', async () => {
      repository.setAttendances(userId, [
        {
          id: 1,
          userId,
          createdAtDate: '2026-01-15',
          createdAt: '2026-01-15T09:00:00+09:00',
        },
        {
          id: 2,
          userId,
          createdAtDate: '2026-01-16',
          createdAt: '2026-01-16T09:00:00+09:00',
        },
      ]);

      repository.setPointActions(userId, [
        {
          id: 100,
          createdAt: '2026-01-15T09:00:01+09:00',
          pointAmount: 100,
          additionalData: { attendance_id: 1 },
          type: 'ATTENDANCE',
        },
        {
          id: 101,
          createdAt: '2026-01-15T09:00:05+09:00',
          pointAmount: 50,
          additionalData: { attendance_id: 1 },
          type: 'ATTENDANCE_AD',
        },
        {
          id: 102,
          createdAt: '2026-01-16T09:00:01+09:00',
          pointAmount: 150,
          additionalData: { attendance_id: 2 },
          type: 'ATTENDANCE',
        },
      ]);

      const result = await service.getAttendances(userId);

      expect(result).toHaveLength(2);
      expect(result[0].point).toBe(100);
      expect(result[0].adShowPoint).toBe(50);
      expect(result[1].point).toBe(150);
      expect(result[1].adShowPoint).toBeNull();
    });

    it('포인트 액션이 없는 출석 기록은 null을 반환한다', async () => {
      repository.setAttendances(userId, [
        {
          id: 1,
          userId,
          createdAtDate: '2026-01-15',
          createdAt: '2026-01-15T09:00:00+09:00',
        },
      ]);

      const result = await service.getAttendances(userId);

      expect(result).toHaveLength(1);
      expect(result[0].point).toBeNull();
      expect(result[0].adShowPoint).toBeNull();
    });

    it('다른 사용자의 출석 기록은 포함하지 않는다', async () => {
      const otherUserId = 'other-user-id';

      repository.setAttendances(userId, [
        {
          id: 1,
          userId,
          createdAtDate: '2026-01-15',
          createdAt: '2026-01-15T09:00:00+09:00',
        },
      ]);

      repository.setAttendances(otherUserId, [
        {
          id: 2,
          userId: otherUserId,
          createdAtDate: '2026-01-15',
          createdAt: '2026-01-15T10:00:00+09:00',
        },
      ]);

      const result = await service.getAttendances(userId);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });

    it('attendance_id가 일치하지 않는 포인트 액션은 매핑하지 않는다', async () => {
      repository.setAttendances(userId, [
        {
          id: 1,
          userId,
          createdAtDate: '2026-01-15',
          createdAt: '2026-01-15T09:00:00+09:00',
        },
      ]);

      repository.setPointActions(userId, [
        {
          id: 100,
          createdAt: '2026-01-15T09:00:01+09:00',
          pointAmount: 100,
          additionalData: { attendance_id: 999 }, // 다른 attendance_id
          type: 'ATTENDANCE',
        },
      ]);

      const result = await service.getAttendances(userId);

      expect(result).toHaveLength(1);
      expect(result[0].point).toBeNull();
    });
  });
});
